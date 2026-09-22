"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asaasFeePercent = exports.asaasWebhookToken = exports.asaasApiKey = void 0;
exports.asaasBaseUrl = asaasBaseUrl;
exports.asaasCheckoutHost = asaasCheckoutHost;
exports.requireAsaasKey = requireAsaasKey;
exports.asaasFetch = asaasFetch;
exports.feeAmount = feeAmount;
exports.netToDono = netToDono;
exports.todayISO = todayISO;
const params_1 = require("firebase-functions/params");
exports.asaasApiKey = (0, params_1.defineString)('ASAAS_API_KEY', { default: '' });
/** Token do webhook Asaas (header `asaas-access-token`). */
exports.asaasWebhookToken = (0, params_1.defineString)('ASAAS_WEBHOOK_TOKEN', { default: '' });
/** Comissão da plataforma Rally Up em % (0–100), além da tarifa Asaas.
 * O líquido do dono usa preferencialmente `netValue` da cobrança Asaas (já sem tarifa Asaas).
 * Este % só entra como fallback quando netValue não está disponível. */
exports.asaasFeePercent = (0, params_1.defineString)('ASAAS_PLATFORM_FEE_PERCENT', { default: '0' });
function asaasBaseUrl() {
    const key = exports.asaasApiKey.value();
    if (key.includes('_hmlg_') || key.includes('_test_')) {
        return 'https://api-sandbox.asaas.com';
    }
    return 'https://api.asaas.com';
}
function asaasCheckoutHost() {
    const key = exports.asaasApiKey.value();
    if (key.includes('_hmlg_') || key.includes('_test_')) {
        return 'https://sandbox.asaas.com';
    }
    return 'https://asaas.com';
}
function requireAsaasKey() {
    const key = exports.asaasApiKey.value()?.trim();
    if (!key)
        throw new Error('ASAAS_API_KEY não configurado em functions/.env');
    return key;
}
async function asaasFetch(path, init) {
    const key = requireAsaasKey();
    const qs = init?.query
        ? '?' +
            Object.entries(init.query)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&')
        : '';
    const url = `${asaasBaseUrl()}${path}${qs}`;
    const resp = await fetch(url, {
        method: init?.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            access_token: key,
            'User-Agent': 'RallyUp/1.0',
        },
        body: init?.body != null ? JSON.stringify(init.body) : undefined,
    });
    const text = await resp.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    }
    catch {
        data = { raw: text };
    }
    if (!resp.ok) {
        const errObj = data;
        const desc = errObj.errors?.[0]?.description ||
            errObj.message ||
            text.slice(0, 300) ||
            `Asaas HTTP ${resp.status}`;
        throw new Error(desc);
    }
    return data;
}
function feeAmount(valor) {
    const pct = Math.max(0, Math.min(100, Number(exports.asaasFeePercent.value() || 0)));
    return Math.round(valor * (pct / 100) * 100) / 100;
}
function netToDono(valor) {
    return Math.round((valor - feeAmount(valor)) * 100) / 100;
}
function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
//# sourceMappingURL=asaasClient.js.map