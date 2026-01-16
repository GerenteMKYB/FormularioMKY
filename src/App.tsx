import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Authenticated, Unauthenticated } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { SignInForm } from "./SignInForm";
import { MaquininhasForm } from "./MaquininhasForm";
import { OrdersList } from "./OrdersList";
import { AdminPanel } from "./AdminPanel";

export default function App() {
  const authInfo = useQuery(api.auth.authInfo);
  const loggedInUser = useQuery(api.users.getMe);
  const { signOut } = useAuthActions();

  const isAdmin = !!authInfo?.isAdmin;

  // Abas do topo (só admin vê)
  const [activeTab, setActiveTab] = useState<"pedidos" | "admin">("pedidos");

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto w-full max-w-[920px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-primary/25 border border-primary/30" />
            <div className="min-w-0">
              <div className="font-semibold tracking-tight truncate">Pedido de Maquininhas</div>
              <div className="text-xs text-white/60 truncate">
                {loggedInUser?.email ?? authInfo?.email ?? ""}
              </div>
            </div>

            {isAdmin && (
              <span className="ml-2 hidden sm:inline-flex text-[11px] px-2 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary">
                Admin
              </span>
            )}
          </div>

          <Authenticated>
            <button
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
              onClick={() => void signOut()}
            >
              Sair
            </button>
          </Authenticated>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[920px] px-4 py-10">
        <Unauthenticated>
          <div className="max-w-md mx-auto bg-white/5 p-6 rounded-2xl border border-white/10">
            <h1 className="text-2xl font-semibold mb-2">Acesso</h1>
            <p className="text-white/70 mb-6">Faça login para enviar o pedido.</p>
            <SignInForm />
          </div>
        </Unauthenticated>

        <Authenticated>
          <section className="mb-6">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-8">
              <div className="max-w-3xl">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                  Solicitação de Maquininhas
                </h1>
                <p className="mt-3 text-white/70">
                  Preencha os dados, escolha o modelo e finalize. O total (à vista ou parcelado) é calculado em tempo real.
                </p>
              </div>
            </div>
          </section>

          {/* Menu ADM separado */}
          {isAdmin && (
            <section className="mb-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2 flex gap-2">
                <button
                  className={[
                    "flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition",
                    activeTab === "pedidos"
                      ? "bg-primary text-white"
                      : "bg-black/20 text-white/70 hover:bg-black/30",
                  ].join(" ")}
                  onClick={() => setActiveTab("pedidos")}
                >
                  Pedidos
                </button>

                <button
                  className={[
                    "flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition",
                    activeTab === "admin"
                      ? "bg-primary text-white"
                      : "bg-black/20 text-white/70 hover:bg-black/30",
                  ].join(" ")}
                  onClick={() => setActiveTab("admin")}
                >
                  Painel ADM
                </button>
              </div>
            </section>
          )}

          {/* Conteúdo por aba */}
          {isAdmin && activeTab === "admin" ? (
            <AdminPanel />
          ) : (
            <section className="space-y-6">
              <MaquininhasForm />
              <OrdersList isAdmin={isAdmin} />
            </section>
          )}
        </Authenticated>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/50">
        Make Your Bank • Formulário interno
      </footer>
    </div>
  );
}
