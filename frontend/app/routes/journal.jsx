import { useEffect, useState } from "react";
import { data, Form, useNavigation } from "react-router";
import { SavedPopup } from "../components/saved-popup";
import editIcon from "../images/edit_icon.png";
import { api, ApiError } from "../lib/api";
import { SavedRecipesSection } from "./SavedRecipesSection";
import "../styles/journal.css";

const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const entryDate = (value) => String(value).slice(0, 10);

export async function clientLoader() {
  const [entries, savedRecipes, savedGuides] = await Promise.all([
    api("/journal-entries"),
    api("/bookmarks"),
    api("/saved-guides"),
  ]);
  return { entries, savedRecipes, savedGuides };
}

export async function clientAction({ request }) {
  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "save-entry") {
      const id = form.get("id");
      const payload = JSON.stringify({
        entry_date: form.get("entry_date"),
        title: form.get("title"),
        location: form.get("location"),
        notes: form.get("notes"),
      });
      const entry = await api(id
        ? `/journal-entries/${encodeURIComponent(id)}`
        : "/journal-entries", {
        method: id ? "PUT" : "POST",
        body: payload,
      });
      return { saved: true, entry };
    }

    if (intent === "save-guide") {
      const guide = await api("/saved-guides", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          url: form.get("url"),
        }),
      });
      return { guide };
    }

    if (intent === "delete-guide") {
      await api(`/saved-guides/${encodeURIComponent(form.get("id"))}`, { method: "DELETE" });
      return { guideDeleted: true };
    }

    throw new Error("Unknown journal action.");
  } catch (error) {
    if (error instanceof ApiError) {
      return data({ error: error.message, saved: false }, { status: error.status });
    }
    throw error;
  }
}

function EntryEditor({ entry, number, busy, error, onCancel }) {
  return (
    <Form method="post" className="journal-editor">
      <input type="hidden" name="intent" value="save-entry" />
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="journal-editor-topline">
        <span>No. {String(number).padStart(2, "0")}</span>
        <button type="button" onClick={onCancel} aria-label="Close entry editor">×</button>
      </div>
      <label className="journal-editor-title">
        <span className="sr-only">Entry title</span>
        <input name="title" defaultValue={entry?.title ?? ""} placeholder="What did you find?" maxLength={160} required />
      </label>
      <div className="journal-editor-meta">
        <label>
          <span>Date</span>
          <input type="date" name="entry_date" defaultValue={entry ? entryDate(entry.entry_date) : localDate(new Date())} required />
        </label>
        <label>
          <span>Location</span>
          <input name="location" defaultValue={entry?.location ?? ""} placeholder="Where did you find it?" maxLength={160} />
        </label>
      </div>
      <label className="journal-editor-notes">
        <span className="sr-only">Field notes</span>
        <textarea name="notes" defaultValue={entry?.notes ?? ""} placeholder="What did you notice?" maxLength={20000} rows={7} />
      </label>
      {error && <p className="journal-error" role="alert">{error}</p>}
      <div className="journal-editor-actions">
        <span className="journal-editor-mark" aria-hidden="true">✦</span>
        <div>
          <button type="button" className="journal-cancel-button" onClick={onCancel}>Cancel</button>
          <button className="journal-save-button" disabled={busy}>{busy ? "Saving..." : entry ? "Update entry" : "Save entry"}</button>
        </div>
      </div>
    </Form>
  );
}

function MonthCalendar({ entries, month, onMonthChange, selectedDate, onSelectDate }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((startOffset + dayCount) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, index) => {
    const day = index - startOffset + 1;
    return day > 0 && day <= dayCount ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
  const entryDates = new Set(entries.map((entry) => entryDate(entry.entry_date)));

  return (
    <section className="journal-calendar-section" aria-label="Journal calendar">
      <div className="journal-calendar">
        <div className="journal-calendar-heading">
          <button type="button" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
          <h2>{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
          <button type="button" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button>
        </div>
        <div className="journal-calendar-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span className="journal-calendar-weekday" key={day}>{day}</span>
          ))}
          {days.map((day, index) => {
            if (!day) return <span className="journal-calendar-empty" key={`empty-${index}`} />;
            const key = localDate(day);
            const hasEntry = entryDates.has(key);
            const selected = selectedDate === key;
            return (
              <button
                type="button"
                key={key}
                className={`journal-calendar-day${hasEntry ? " has-entry" : ""}${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                aria-label={`${day.toLocaleDateString("en-GB", { dateStyle: "long" })}${hasEntry ? ", has entries" : ""}`}
                onClick={() => onSelectDate(selected ? "" : key)}
              >
                {day.getDate()}
                {hasEntry && <span className="journal-calendar-dot" />}
              </button>
            );
          })}
        </div>
        <p className="journal-calendar-hint">Select a day to see its field notes.</p>
        {selectedDate && <button className="journal-clear-date" type="button" onClick={() => onSelectDate("")}>Show all entries</button>}
      </div>
    </section>
  );
}

export default function Journal({ loaderData, actionData }) {
  const { entries, savedRecipes, savedGuides } = loaderData;
  const busy = useNavigation().state !== "idle";
  const [editingEntry, setEditingEntry] = useState(null);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  useEffect(() => {
    if (actionData?.saved) setEditingEntry(null);
  }, [actionData]);

  const visibleEntries = selectedDate
    ? entries.filter((entry) => entryDate(entry.entry_date) === selectedDate)
    : entries;

  return (
    <section className="journal-page">
      <div className="journal-heading">
        <h1>Your foraging journal</h1>
      </div>
      <div className="journal-section-heading">
        <p>Field notes · <span>{entries.length} {entries.length === 1 ? "entry" : "entries"}</span></p>
        <button
          className="journal-new-button"
          type="button"
          onClick={() => setEditingEntry({ creating: true })}
        >＋ New entry</button>
      </div>

      {actionData?.error && !editingEntry && <p className="journal-error" role="alert">{actionData.error}</p>}
      {editingEntry && (
        <EntryEditor
          key={editingEntry.id ?? "new"}
          entry={editingEntry.creating ? null : editingEntry}
          number={entries.length + (editingEntry.creating ? 1 : 0)}
          busy={busy}
          error={actionData?.error}
          onCancel={() => setEditingEntry(null)}
        />
      )}

      <div className="journal-actions">
        <button
          className="journal-view-all"
          type="button"
          aria-expanded={entriesOpen}
          onClick={() => setEntriesOpen((open) => !open)}
        >
          {entriesOpen ? "Hide entries" : `View entries (${entries.length})`}
        </button>
        <button
          className="journal-view-all"
          type="button"
          aria-expanded={calendarOpen}
          onClick={() => setCalendarOpen((open) => !open)}
        >
          {calendarOpen ? "Hide calendar" : "View calendar"}
        </button>
      </div>
      {calendarOpen && (
        <MonthCalendar
          entries={entries}
          month={month}
          onMonthChange={setMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {entriesOpen && (
        <section className="journal-entries" aria-label="Field notes">
          {visibleEntries.length ? visibleEntries.map((entry) => {
            const number = entries.length - entries.indexOf(entry);
            return (
              <article className="journal-entry-card" key={entry.id}>
                <button className="journal-entry-edit" type="button" aria-label={`Edit ${entry.title}`} onClick={() => setEditingEntry(entry)}>
                  <img src={editIcon} alt="" />
                </button>
                <div className="journal-entry-overline">
                  <span>Field note</span>
                  <span>No. {String(number).padStart(2, "0")}</span>
                </div>
                <h2>{entry.title}</h2>
                <div className="journal-entry-meta">
                  <time dateTime={entryDate(entry.entry_date)}>
                    {new Date(`${entryDate(entry.entry_date)}T00:00:00`).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                  </time>
                  {entry.location && <span>{entry.location}</span>}
                </div>
                {entry.notes && <p className="journal-entry-notes">{entry.notes}</p>}
              </article>
            );
          }) : (
            <p className="journal-empty">{selectedDate ? "No field notes for this day." : "Your field notes will appear here. Add your first entry when you head out exploring."}</p>
          )}
        </section>
      )}
    
      <SavedRecipesSection savedRecipes={savedRecipes} savedGuides={savedGuides} />
      <SavedPopup result={actionData} message="Your field note has been saved!" />
    </section>
  );
}
