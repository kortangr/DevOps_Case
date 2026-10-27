import React, { useState } from "react";
import { useNavigate } from "react-router";
import { LEVELS, validateForm } from "../validation";

export default function Create() {
  const [form, setForm] = useState({
    name: "",
    position: "",
    level: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
      const response = await fetch("/api/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
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
    setForm({ name: "", position: "", level: "" });
    navigate("/");
  }

  return (
    <div>
      <h3>Create New Record</h3>
      {error && (
        <div className="alert alert-danger">{error}</div>
      )}
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name</label>
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
          <label htmlFor="position">Position</label>
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
        <div className="form-group">
          <input
            type="submit"
            value="Create person"
            className="btn btn-primary"
          />
        </div>
      </form>
    </div>
  );
}                                                                                                                                                