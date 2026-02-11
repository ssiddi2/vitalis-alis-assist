import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import { toast } from 'sonner';
import { Loader2, Shield, UserX, Mail } from 'lucide-react';

interface ManagedUser {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  hospitals: Array<{ hospital_id: string; hospital_name: string; access_level: string }>;
  created_at: string;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
}

interface EditUserModalProps {
  user: ManagedUser | null;
  hospitals: Hospital[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditUserModal({ user, hospitals, open, onOpenChange, onUpdated }: EditUserModalProps) {
  const [role, setRole] = useState('');
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);
  const [pendingRole, setPendingRole] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setSelectedHospitals(user.hospitals.map(h => h.hospital_id));
    }
  }, [user]);

  if (!user) return null;

  const handleRoleChange = (newRole: string) => {
    if (newRole === 'admin' && user.role !== 'admin') {
      setPendingRole(newRole);
      setShowRoleConfirm(true);
    } else {
      setRole(newRole);
    }
  };

  const confirmRoleChange = () => {
    setRole(pendingRole);
    setShowRoleConfirm(false);
  };

  const toggleHospital = (hospitalId: string) => {
    setSelectedHospitals(prev =>
      prev.includes(hospitalId) ? prev.filter(id => id !== hospitalId) : [...prev, hospitalId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await authenticatedFetch('admin-create-user', {
      body: {
        action: 'update_user',
        target_user_id: user.user_id,
        role,
        hospital_ids: selectedHospitals,
      },
    });
    setSaving(false);
    if (!error) {
      toast.success(`Updated ${user.full_name || user.email}`);
      onUpdated();
      onOpenChange(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    const { error } = await authenticatedFetch('admin-create-user', {
      body: { action: 'deactivate_user', target_user_id: user.user_id },
    });
    setDeactivating(false);
    setShowDeactivateConfirm(false);
    if (!error) {
      toast.success(`Deactivated ${user.full_name || user.email}`);
      onUpdated();
      onOpenChange(false);
    }
  };

  const handleResendInvite = async () => {
    setResending(true);
    const { error } = await authenticatedFetch('admin-create-user', {
      body: { action: 'resend_invite', email: user.email },
    });
    setResending(false);
    if (!error) {
      toast.success(`Invitation resent to ${user.email}`);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-strong border-border/50 rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                {user.full_name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-foreground">{user.full_name || 'Unnamed'}</p>
                <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">Edit user settings</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Role */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                Role
              </Label>
              <Select value={role} onValueChange={handleRoleChange}>
                <SelectTrigger className="h-10 rounded-xl bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="clinician">Clinician</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hospital assignments */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Hospital Access</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl bg-secondary/30 p-3 border border-border/50">
                {hospitals.map(h => (
                  <label
                    key={h.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedHospitals.includes(h.id)}
                      onCheckedChange={() => toggleHospital(h.id)}
                    />
                    <span className="text-sm text-foreground">{h.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{h.code}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 mr-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendInvite}
                disabled={resending}
                className="gap-1.5 rounded-xl text-xs"
              >
                {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                Resend Invite
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeactivateConfirm(true)}
                className="gap-1.5 rounded-xl text-xs text-critical hover:text-critical hover:bg-critical/10 border-critical/20"
              >
                <UserX className="h-3 w-3" />
                Deactivate
              </Button>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 rounded-xl btn-primary-gradient"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent className="glass-strong border-critical/20 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable <strong>{user.full_name || user.email}</strong>'s access.
              They will not be able to sign in until reactivated. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={deactivating}
              className="rounded-xl bg-critical text-critical-foreground hover:bg-critical/90 gap-2"
            >
              {deactivating && <Loader2 className="h-4 w-4 animate-spin" />}
              Yes, Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin role escalation confirmation */}
      <AlertDialog open={showRoleConfirm} onOpenChange={setShowRoleConfirm}>
        <AlertDialogContent className="glass-strong border-warning/20 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Escalate to Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Granting admin privileges to <strong>{user.full_name || user.email}</strong> will
              allow them to manage all users and settings. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} className="rounded-xl btn-primary-gradient">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
