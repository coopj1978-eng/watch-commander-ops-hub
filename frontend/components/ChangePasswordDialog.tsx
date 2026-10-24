import { useState } from "react";
import { backendClient } from "@/lib/backend";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

// Any signed-in user can change their own password. It checks the current
// one first; afterwards logins on other devices stop working and this device
// is given a fresh one, so the user stays signed in here.
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = (o: boolean) => {
    if (!o) {
      setCurrent("");
      setNext("");
      setConfirmNext("");
      setError("");
    }
    onOpenChange(o);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirmNext) return setError("The new passwords don't match.");
    if (next === current) return setError("Choose a different password from your current one.");

    setSaving(true);
    try {
      const res = await backendClient.localauth.changePassword({ current_password: current, new_password: next });
      localStorage.setItem("auth_token", res.token);
      toast({ title: "Password changed", description: "Any other devices signed in as you have been signed out." });
      close(false);
    } catch (err: any) {
      setError(err?.message || "Couldn't change your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            You'll stay signed in here; any other phones or computers signed in as you will need the new password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Current password</Label>
            <Input id="cp-current" type="password" autoComplete="current-password" value={current}
              onChange={(e) => setCurrent(e.target.value)} required disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">New password</Label>
            <Input id="cp-new" type="password" autoComplete="new-password" value={next}
              onChange={(e) => setNext(e.target.value)} required minLength={8} disabled={saving} />
            <p className="text-xs text-muted-foreground">At least 8 characters</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <Input id="cp-confirm" type="password" autoComplete="new-password" value={confirmNext}
              onChange={(e) => setConfirmNext(e.target.value)} required disabled={saving} />
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !current || !next || !confirmNext}>
              {saving ? "Saving…" : "Change password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
