"use node";

// Arquivo opcional (não usado). Mantido apenas para evitar referências quebradas no repo.
// Se quiser, pode deletar este arquivo.

import { action } from "./_generated/server";

export const health = action({
  handler: async () => {
    return { ok: true };
  },
});
