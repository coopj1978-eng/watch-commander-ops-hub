import { useState } from "react";
import backend from "@/lib/backend";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { CheckCircle, Copy } from "lucide-react";

const WATCHES = ["Red", "White", "Blue", "Green", "Amber"];
const RANKS = ["Firefighter", "Leading Firefighter", "Crew Commander", "Watch Commander"];

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Admin: add someone and get their invite link. They count on their watch
// straight away; the link (one-time, 14 days) lets them choose their own
// password — the admin never sets or sees it.
export function InviteUserDialog({ open, onClose, onSuccess }: InviteUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rank, setRank] = useState("Firefighter");
  const [watchUnit, setWatchUnit] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const { toast } = useToast();

  const handleClose = () => {
    setName(""); setEmail(""); setRank("Firefighter"); setWatchUnit("");
    setInviteLink("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !watchUnit) {
      toast({ variant: "destructive", title: "Name, email and watch are required" });
      return;
    }
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      await backend.profile.createPerson({
        name: name.trim(),
        email: cleanEmail,
        rank,
        watch_unit: watchUnit,
      });
      const invite = await backend.admin.getInviteLink({
        email: cleanEmail,
        frontend_url: window.location.origin,
      });
      onSuccess();
      if (invite.already_active) {
        toast({ title: "Already set up", description: `${invite.user_name} already has a login.` });
        handleClose();
        return;
      }
      setInviteLink(invite.invite_link);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't add them",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{inviteLink ? `Invite ${name}` : "Add Staff Member"}</DialogTitle>
          {inviteLink && (
            <DialogDescription>
              {name} is now on {watchUnit} Watch. Send them this link — they choose their own password. It works once, for 14 days.
            </DialogDescription>
          )}
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <p className="text-sm font-medium">Added {name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteLink} className="flex-1 text-xs font-mono" />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  toast({ title: "Invite link copied" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share it privately (WhatsApp, Teams, email) — anyone with the link can set the password.
            </p>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="iu-name">Full name</Label>
              <Input id="iu-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iu-email">Email</Label>
              <Input id="iu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Rank</Label>
                <Select value={rank} onValueChange={setRank}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Watch</Label>
                <Select value={watchUnit} onValueChange={setWatchUnit}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {WATCHES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Adding…" : "Add and get invite link"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
