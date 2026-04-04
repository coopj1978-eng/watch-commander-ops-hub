import { useState } from "react";
import backend from "@/lib/backend";
import type { UserRole } from "~backend/user/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";

const WATCHES = ["Red", "White", "Blue", "Green", "Amber"];
const RANKS = ["Firefighter", "Leading Firefighter", "Crew Commander", "Watch Commander"];

function generatePassword(): string {
  const words = ["Fire", "Station", "Watch", "Shift", "Engine", "Crew", "Pump", "Ladder"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(Math.random() * 900) + 100;
  const sym = ["!", "@", "#", "$"][Math.floor(Math.random() * 4)];
  return `${w}${n}${sym}`;
}

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteUserDialog({ open, onClose, onSuccess }: InviteUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("FF");
  const [watchUnit, setWatchUnit] = useState("");
  const [rank, setRank] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const { toast } = useToast();

  const handleClose = () => {
    setName(""); setEmail(""); setRole("FF"); setWatchUnit("");
    setRank(""); setPassword(generatePassword());
    setShowPassword(false); setCreated(false);
    onClose();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied` });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Name, email and password are required" });
      return;
    }

    setLoading(true);
    try {
      await (backend.admin as any).createAccount({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        watch_unit: watchUnit || undefined,
        rank: rank || undefined,
      });

      setCreated(true);
      onSuccess();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create account",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {created ? "Account Created" : "Add Staff Member"}
          </DialogTitle>
        </DialogHeader>

        {created ? (
          /* ── Success screen — show credentials to hand to new member ── */
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <p className="text-sm font-medium">Account created for {name}</p>
            </div>

            <p className="text-sm text-muted-foreground">
              Share these login details with the new team member. They can change their password from Settings after first login.
            </p>

            <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                  <p className="text-sm font-mono font-medium">{email}</p>
                </div>
                <button onClick={() => copyToClipboard(email, "Email")} className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Temporary password</p>
                  <p className="text-sm font-mono font-medium">{password}</p>
                </div>
                <button onClick={() => copyToClipboard(password, "Password")} className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full bg-indigo-600 hover:bg-indigo-700">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          /* ── Create form ── */
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Name */}
              <div className="col-span-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. James Robertson" className="mt-1" required />
              </div>

              {/* Email */}
              <div className="col-span-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="james@firescotland.gov.uk" className="mt-1" required />
              </div>

              {/* Role */}
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WC">Watch Commander</SelectItem>
                    <SelectItem value="CC">Crew Commander</SelectItem>
                    <SelectItem value="FF">Firefighter</SelectItem>
                    <SelectItem value="RO">Read Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Watch */}
              <div>
                <Label>Watch</Label>
                <Select value={watchUnit} onValueChange={setWatchUnit}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {WATCHES.map((w) => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rank */}
              <div className="col-span-2">
                <Label>Rank</Label>
                <Select value={rank} onValueChange={setRank}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select rank…" />
                  </SelectTrigger>
                  <SelectContent>
                    {RANKS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Temporary password */}
              <div className="col-span-2">
                <Label htmlFor="password">Temporary Password</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-9 font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPassword(generatePassword())}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  You'll see the full credentials to share after creating the account.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                {loading ? "Creating…" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
