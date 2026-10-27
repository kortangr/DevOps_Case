import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { LEVELS, validateForm } from "../validation";

export default function Edit() {
  const [form, setForm] = useState({
    name: "",
    position: "",
    level: "",
  });
  const [error, setError] = useState("");
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const url = `/api/record/${params.id}`;
        const response = await fetch(url);
        if (!response.ok) {
          const body = await response
            .json()
            .catch(() => ({}));
          setError(body.hata || response.statusText);
          return;
        }
        const record = await response.json();
        setForm({
          name: record.name,
          position: record.position,
          level: record.level,
        });
      } catch (err) {
        setError(`Request failed: ${err.message}`);
      }
    }
    fetchData();
  }, [params.id]);

  function updateForm(value) {
    setForm((prev) => ({ ...prev, ...value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const problem = validateForm(form);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const url = `/api/record/${params.id}`;
      const response = await fetch(url, {
        method: "PATCH",
        body: JSON.stringify(form),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({}));
        setError(body.hata || response.statusText);
        return;
      }
    } catch (err) {
      setError(`Request failed: ${err.message}`);
      return;
    }
    navigate("/");
  }

  return (
    <div>
      <h3>Update Record</h3>
      {error && (
        <div className="alert alert-danger">{error}</div>
      )}
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name: </label>
          <input
            type="text"
            className="form-control"
            id="name"
            value={form.name}
            onChange={(e) =>
              updateForm({ name: e.target.value })
            }
          />
        </div>
        <div className="form-group">
          <label htmlFor="position">Position: </label>
          <input
            type="text"
            className="form-control"
            id="position"
            value={form.position}
            onChange={(e) =>
              updateForm({ position: e.target.value })
            }
          />
        </div>
        <div className="form-group">
          {LEVELS.map((level) => (
            <div
              key={level}
              className="form-check form-check-inline"
            >
              <input
                className="form-check-input"
                type="radio"
                name="positionOptions"
                id={`position${level}`}
                value={level}
                checked={form.level === level}
                onChange={() => updateForm({ level })}
              />
              <label
                htmlFor={`position${level}`}
                className="form-check-label"
              >
                {level}
              </label>
            </div>
          ))}
        </div>
        <br />
        <div className="form-group">
          <input
            type="submit"
            value="Update Record"
            className="btn btn-primary"
          />
        </div>
      </form>
    </div>
  );
}