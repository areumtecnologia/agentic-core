'use strict';

/**
 * IntentRouter — Roteador e classificador heurístico de intenções para SLMs e Frontier LLMs.
 * 
 * Centraliza regras de regex, detecção de padrões determinísticos (PAL - Program-Aided Language)
 * e poda dinâmica de ferramentas (Tool Pruning) para turnos conversacionais bilíngues (PT-BR / EN-US).
 */
class IntentRouter {
    /**
     * Normaliza texto removendo acentuação e convertendo para minúsculas.
     * @param {string} text
     * @returns {string}
     */
    static normalizeText(text) {
        if (!text || typeof text !== 'string') return '';
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    /**
     * Extrai a mensagem textual pura do usuário a partir de string ou array de turnos.
     * @param {string|Array} textOrContents
     * @returns {string}
     */
    static extractUserText(textOrContents) {
        if (!textOrContents) return '';
        let raw = '';
        if (typeof textOrContents === 'string') {
            raw = textOrContents;
        } else if (Array.isArray(textOrContents)) {
            const userTurns = textOrContents.filter(c => c.role === 'user' && !c.parts?.some(p => typeof p.text === 'string' && p.text.includes('[System directive')));
            const lastUserTurn = userTurns[userTurns.length - 1];
            if (!lastUserTurn) return '';

            if (Array.isArray(lastUserTurn.parts)) {
                raw = lastUserTurn.parts.map(p => p.text || '').join(' ').trim();
            } else if (typeof lastUserTurn.parts === 'string') {
                raw = lastUserTurn.parts.trim();
            }
        }

        // Remove envelope de contexto do usuário se presente (ex: "User: ...\nPhone: ...\nMessage: ...")
        const messageMatch = raw.match(/Message:\s*([\s\S]+)$/i);
        if (messageMatch) {
            raw = messageMatch[1].trim();
        }
        return raw;
    }

    /**
     * Verifica se a mensagem é uma consulta de data/hora atual.
     * @param {string|Array} textOrContents
     * @returns {boolean}
     */
    static shouldEnforceDatetime(textOrContents) {
        const text = this.normalizeText(this.extractUserText(textOrContents));
        if (!text) return false;
        return /\b(que horas|qual e a hora|hora atual|data de hoje|que dia e hoje|data e hora|horario atual|what time|current time|what is the date|today'?s date|date and time)\b/i.test(text);
    }

    /**
     * Verifica se a mensagem expressa encerramento deliberado da conversa.
     * @param {string|Array} textOrContents
     * @returns {boolean}
     */
    static shouldEnforceClosing(textOrContents) {
        const text = this.normalizeText(this.extractUserText(textOrContents));
        if (!text) return false;
        return /\b(finalizar sessao|encerrar (o )?chat|encerrar (a )?conversa|fechar (o )?chat|fechar (a )?conversa|fim do chat|terminar (o )?chat|close (the )?chat|end (the )?chat|end (the )?conversation|terminate (the )?session)\b/i.test(text);
    }

    /**
     * Verifica se a mensagem contém cálculo matemático explícito (PAL Math).
     * @param {string|Array} contents
     * @returns {boolean}
     */
    static shouldEnforceMath(contents) {
        const text = this.normalizeText(this.extractUserText(contents));
        if (!text) return false;
        const mathPattern = /[\d]+[\s]*[\+\-\*\/xX÷=][\s]*[\d]+|\b\d+[\.,]?\d*\s*[%]|\b(calcul\w*|expressao\w*|equacao\w*|desconto\w*|porcent\w*|soma\w*|subtra\w*|multiplic\w*|divis\w*|quanto (e|custa|sobra|fica|vale)|math\w*|solve\w*|discount\w*|percentage\w*|how much\w*)\b/i;
        return mathPattern.test(text);
    }

    /**
     * Verifica se a mensagem exige raciocínio dedutivo passo a passo.
     * @param {string|Array} contents
     * @param {boolean} [hasMathTool=true]
     * @returns {boolean}
     */
    static shouldEnforceReasoning(contents, hasMathTool = true) {
        const text = this.normalizeText(this.extractUserText(contents));
        if (!text) return false;
        const reasoningPattern = /\b(pense|pensar|planej\w*|raciocin\w*|deduz\w*|passo a passo|step by step|analis\w*|compar\w*|por que|explique como|qual a logica|problem\w*|charada|enigma)\b/i;
        if (!hasMathTool) {
            const fallbackMathPattern = /[\d]+[\s]*[\+\-\*\/xX÷=][\s]*[\d]+|\b\d+[\.,]?\d*\s*[%]|\b(calcul\w*|resolv\w*|expressao\w*|equacao\w*|desconto\w*|porcent\w*|quanto (e|custa|sobra|fica|vale)|quantos|total|matemat\w*|math\w*|calculate\w*|solve\w*)\b/i;
            return reasoningPattern.test(text) || fallbackMathPattern.test(text);
        }
        return reasoningPattern.test(text);
    }

    /**
     * Verifica se a mensagem necessita de busca na web.
     * @param {string|Array} contents
     * @returns {boolean}
     */
    static shouldEnforceWebSearch(contents) {
        const text = this.normalizeText(this.extractUserText(contents));
        if (!text) return false;

        // Se for saudação ou pergunta de identidade, nunca acionar busca web
        if (/\b(ola|oi|bom dia|boa tarde|boa noite|tudo bem|opa|salve|quem e voce|o que voce e|qual e o seu nome|apresente-se|se apresente|hello|hi|who are you)\b/i.test(text)) {
            return false;
        }

        // Se for pergunta conceitual geral sem pedido explícito de busca
        if (/\b(explique|defina|resuma|conceito\s+de|em\s+uma\s+frase|explain|define|summarize)\b/i.test(text) && !/\b(pesquis|busc|procur|google|internet|web|site|search)\b/i.test(text)) {
            return false;
        }

        const searchPattern = /\b(pesquis\w*|busc\w*|procur\w*|search\w*|google\w*|noticia\w*|noticias\w*|quem foi|informacoes sobre|site oficial|site da|atualidade\w*|ultimas noticias)\b/i;
        const entityQuery = /\b(quem e|o que e)\s+(?!voce\b|ia\b|inteligencia\s+artificial\b)/i;
        return searchPattern.test(text) || entityQuery.test(text);
    }

    /**
     * Poda ferramentas irrelevantes para o turno atual para reduzir o contexto de SLMs.
     * @param {Array<object>} toolsDeclarations
     * @param {string} userText
     * @param {object} [options={}]
     * @returns {Array<object>}
     */
    static pruneToolsForTurn(toolsDeclarations, userText, options = {}) {
        if (!toolsDeclarations || toolsDeclarations.length <= 1) return toolsDeclarations;
        const text = this.normalizeText(userText);

        // 1. Saudação ou identidade
        const isGreetingOrIdentity = /\b(ola|oi|bom dia|boa tarde|boa noite|tudo bem|opa|salve|quem e voce|o que voce e|qual e o seu nome|apresente-se|se apresente|hello|hi|good morning|good afternoon|good evening|who are you|what is your name)\b/i.test(text);

        if (isGreetingOrIdentity) {
            return toolsDeclarations.filter(t => t.declaration?.name === 'report_vulnerability_attempt');
        }

        // 2. Fechamento de sessão
        if (this.shouldEnforceClosing(text)) {
            const closingTool = toolsDeclarations.find(t => /end_chat|close_session|terminate_session|encerrar/i.test(t.declaration?.name || ''));
            if (closingTool) {
                return [closingTool];
            }
        }

        // 3. Consulta de data/hora
        if (this.shouldEnforceDatetime(text)) {
            const datetimeTool = toolsDeclarations.find(t => /datetime|hora|time|data/i.test(t.declaration?.name || ''));
            if (datetimeTool) {
                return [datetimeTool];
            }
        }

        // 4. Pergunta conceitual/definição sem busca
        if (/\b(explique|defina|resuma|conceito\s+de|em\s+uma\s+frase|explain|define|summarize)\b/i.test(text) && !/\b(pesquis|busc|procur|google|internet|web|site|search)\b/i.test(text)) {
            return toolsDeclarations.filter(t => {
                const name = t.declaration?.name;
                return name !== options.webSearchToolName;
            });
        }

        return toolsDeclarations;
    }
}

module.exports = { IntentRouter };
