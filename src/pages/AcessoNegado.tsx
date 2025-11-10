import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";

const AcessoNegado = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Recuperar origem do redirecionamento (se disponível)
  const origem = useMemo(() => {
    if (location.state && typeof location.state === "object") {
      const { from } = location.state as { from?: string | null };
      return from || null;
    }
    return null;
  }, [location.state]);

  useEffect(() => {
    console.warn(
      "Acesso negado. Origem:",
      origem ?? "Origem não fornecida ou acesso direto."
    );
  }, [origem]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted text-center px-6">
      <div className="max-w-xl w-full bg-background shadow-lg rounded-2xl p-10 border">
        <h1 className="text-3xl font-semibold text-destructive mb-4">
          Acesso não autorizado
        </h1>
        <p className="text-muted-foreground mb-6">
          Você não possui permissão para acessar esta página. Tente novamente ou contate um administrador.
          {origem ? (
            <>
              {" "}
              
            </>
          ) : (
            " "
          )}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={() => navigate("/cronograma")}
          >
            Ir para o cronograma
          </button>
          <button
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-input hover:bg-muted transition-colors"
            onClick={() => navigate(-1)}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AcessoNegado;


