"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProposalWarnings = ProposalWarnings;
const jsx_runtime_1 = require("react/jsx-runtime");
function ProposalWarnings({ warnings }) {
    if (!warnings?.length)
        return null;
    return ((0, jsx_runtime_1.jsxs)("section", { "aria-label": "Avisos da proposta", className: "min-w-0 pt-2 text-xs text-amber-200", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-semibold", children: "Avisos e campos pendentes" }), (0, jsx_runtime_1.jsx)("ul", { "aria-label": "Lista de avisos da proposta", tabIndex: 0, className: "mt-1 max-h-40 space-y-1 overflow-y-auto rounded pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300", children: warnings.map((warning, index) => ((0, jsx_runtime_1.jsx)("li", { className: "break-words [overflow-wrap:anywhere]", children: warning }, index))) })] }));
}
