import { useState } from "react";
import { useUserRole } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Pencil, Plus, Trash2, Check, X, PhoneCall } from "lucide-react";

// ── Types & storage ────────────────────────────────────────────────────────
interface Contact {
  id:    string;
  role:  string;
  name:  string;
  phone: string;
}

const STORAGE_KEY = "wc-duty-contacts";

const DEFAULT_CONTACTS: Contact[] = [
  { id: "1", role: "Duty Area Manager",      name: "", phone: "" },
  { id: "2", role: "On-call BA Instructor",   name: "", phone: "" },
  { id: "3", role: "Station Manager",         name: "", phone: "" },
];

function loadContacts(): Contact[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_CONTACTS;
}

function saveContacts(contacts: Contact[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

// ── Widget ─────────────────────────────────────────────────────────────────
export function WCContactsWidget() {
  const role    = useUserRole();
  const canEdit = role === "WC" || role === "CC";

  const [contacts, setContacts] = useState<Contact[]>(loadContacts);
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState<Contact[]>([]);

  // ── Edit actions ─────────────────────────────────────────────────────────
  const startEdit = () => {
    setDraft(contacts.map(c => ({ ...c })));
    setEditing(true);
  };

  const commitEdit = () => {
    // Strip rows with no role AND no name (but keep placeholders)
    const saved = draft.filter(c => c.role.trim() || c.name.trim() || c.phone.trim());
    setContacts(saved);
    saveContacts(saved);
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const updateDraft = (id: string, field: keyof Contact, value: string) =>
    setDraft(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  const addRow = () =>
    setDraft(prev => [...prev, { id: Date.now().toString(), role: "", name: "", phone: "" }]);

  const removeRow = (id: string) =>
    setDraft(prev => prev.filter(c => c.id !== id));

  // ── Read view ─────────────────────────────────────────────────────────────
  if (!editing) {
    const filled = contacts.filter(c => c.name.trim() || c.phone.trim());
    const hasAny = filled.length > 0;

    return (
      <Card className="border-t-2 border-t-cyan-500">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Duty Contacts
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <PhoneCall className="h-4 w-4 text-cyan-500" />
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={startEdit}
                title="Edit contacts"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-0">
          {!hasAny ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center">
                <Phone className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-sm text-muted-foreground">No contacts set</p>
              {canEdit && (
                <button
                  onClick={startEdit}
                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  Add duty contacts →
                </button>
              )}
            </div>
          ) : (
            /* ── Contact rows ── */
            <div className="divide-y divide-border/50">
              {contacts.map(contact => {
                const hasDetail = contact.name.trim() || contact.phone.trim();
                if (!hasDetail && !contact.role.trim()) return null;
                return (
                  <div key={contact.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    {/* Icon */}
                    <div className="h-8 w-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center shrink-0">
                      <Phone className="h-3.5 w-3.5 text-cyan-500" />
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                        {contact.role || "Contact"}
                      </div>
                      <div className="text-sm font-semibold text-foreground leading-tight mt-0.5">
                        {contact.name || <span className="text-muted-foreground font-normal italic">Not set</span>}
                      </div>
                    </div>

                    {/* Phone — tap to call */}
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone.replace(/\s/g, "")}`}
                        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 text-xs font-semibold hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
                        title={`Call ${contact.name}`}
                      >
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/50 italic shrink-0">No number</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          {hasAny && (
            <div className="pt-3 mt-1 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Tap a number to dial · {canEdit && <button onClick={startEdit} className="text-cyan-500 hover:text-cyan-600 transition-colors">edit contacts</button>}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Edit view ─────────────────────────────────────────────────────────────
  return (
    <Card className="border-t-2 border-t-cyan-500">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium text-foreground">Edit Duty Contacts</CardTitle>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={cancelEdit}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
            onClick={commitEdit}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2.5">
        {draft.map((contact, idx) => (
          <div
            key={contact.id}
            className="rounded-lg border border-border/60 bg-muted/30 p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Contact {idx + 1}
              </span>
              <button
                onClick={() => removeRow(contact.id)}
                className="text-muted-foreground hover:text-red-500 transition-colors p-0.5 rounded"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 outline-none focus:border-cyan-500 transition-colors"
              placeholder="Role (e.g. Duty Area Manager)"
              value={contact.role}
              onChange={e => updateDraft(contact.id, "role", e.target.value)}
            />
            <input
              className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 outline-none focus:border-cyan-500 transition-colors"
              placeholder="Name"
              value={contact.name}
              onChange={e => updateDraft(contact.id, "name", e.target.value)}
            />
            <input
              className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 outline-none focus:border-cyan-500 transition-colors"
              placeholder="Phone number"
              value={contact.phone}
              type="tel"
              onChange={e => updateDraft(contact.id, "phone", e.target.value)}
            />
          </div>
        ))}

        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 w-full py-1 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add contact
        </button>
      </CardContent>
    </Card>
  );
}
