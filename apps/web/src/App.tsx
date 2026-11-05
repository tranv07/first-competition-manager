import { useEffect, useState } from "react";
import { apiHealthSchema } from "@fcm/shared";

type ApiStatus = "checking" | "connected" | "disconnected";

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        apiHealthSchema.parse(await response.json());
        setApiStatus("connected");
      } catch {
        setApiStatus("disconnected");
      }
    };

    void checkApi();
  }, []);

  return (
    <main className="page">
      <section className="welcome-card">
        <p className="eyebrow">FIRST Competition Manager</p>
        <h1>Competition operations, all in one place.</h1>
        <p className="description">
          The project is ready for its first features. This starter connects the
          React frontend to the Hono API and shared validation package.
        </p>
        <div className={`status status--${apiStatus}`} role="status">
          <span className="status-indicator" />
          API {apiStatus}
        </div>
      </section>
    </main>
  );
}
