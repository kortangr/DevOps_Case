import React, { useEffect, useState } from "react";

const ADDRESS = "/api/healthcheck/";

export default function HealthStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    async function check() {
      try {
        const response = await fetch(ADDRESS);
        const body = await response.json();
        setStatus({ ok: response.ok, body });
      } catch (err) {
        setStatus({ ok: false, body: null });
      }
    }
    check();
  }, []);

  function describe() {
    if (status === null) return "Checking...";
    if (status.ok) return "API is healthy";
    if (!status.body) return "API is unreachable";
    const detail = status.body.mongo;
    if (detail) return `MongoDB problem: ${detail}`;
    return "API returned an error";
  }

  return (
    <div>
      <h3>API Status</h3>
      <p>{describe()}</p>
      {status && status.body && (
        <pre>{JSON.stringify(status.body)}</pre>
      )}
    </div>
  );
}
