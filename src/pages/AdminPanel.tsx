import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield, UserPlus, Users, ArrowLeft, Mail, Loader2 } from 'lucide-react';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import alisLogo from '@/assets/alis-logo.png';

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

export default function AdminPanel() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('clinician');
  const [hospitalId, setHospitalId] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [creating, setCreating] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/', { replace: true });
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('admin-create-user', {
        body: { action: 'list_users' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      setUsers(res.data?.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchHospitals = useCallback(async () => {
    const { data, error } = await supabase.from('hospitals').select('id, name, code');
    if (!error && data) setHospitals(data);
  }, []);

  useEffect(() => {
    if (user && isAdmin) {
      fetchUsers();
      fetchHospitals();
    }
  }, [user, isAdmin, fetchUsers, fetchHospitals]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('admin-create-user', {
        body: {
          action: 'create_user',
          email: email.trim(),
          full_name: fullName.trim(),
          role,
          hospital_id: hospitalId || undefined,
          avatar_url: avatarUrl.trim() || undefined,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(`Invitation sent to ${email}`);
      setEmail('');
      setFullName('');
      setRole('clinician');
      setHospitalId('');
      setAvatarUrl('');
      setShowCreateForm(false);
      fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create user';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const getRoleBadgeClass = (r: string) => {
    switch (r) {
      case 'admin': return 'bg-critical/10 text-critical border-critical/20';
      case 'clinician': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <FuturisticBackground />

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="glass-strong border-b border-border px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-critical/10 to-primary/10 flex items-center justify-center border border-critical/20">
                <Shield className="w-5 h-5 text-critical" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Admin Panel</h1>
                <p className="text-xs text-muted-foreground">User Management</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img src={alisLogo} alt="ALIS" className="h-8" />
          </div>
        </header>

        {/* Content */}
        <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8">
          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">
                Users ({users.length})
              </h2>
            </div>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="gap-2 rounded-xl btn-primary-gradient"
            >
              <UserPlus className="w-4 h-4" />
              Invite User
            </Button>
          </div>

          {/* Create user form */}
          {showCreateForm && (
            <div className="glass-strong rounded-2xl border border-border/50 p-6 shadow-elevated animate-in fade-in slide-in-from-top-2 duration-300">
              <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Invite New User
              </h3>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="inv-email" className="text-sm font-medium">Email *</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="provider@hospital.com"
                    className="h-11 rounded-xl bg-secondary/50 border-border/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inv-name" className="text-sm font-medium">Full Name *</Label>
                  <Input
                    id="inv-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Jane Smith"
                    className="h-11 rounded-xl bg-secondary/50 border-border/50"
                    required
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Role *</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinician">Clinician</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hospital</Label>
                  <Select value={hospitalId} onValueChange={setHospitalId}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-border/50">
                      <SelectValue placeholder="Select hospital (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {hospitals.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name} ({h.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inv-avatar" className="text-sm font-medium">Avatar URL</Label>
                  <Input
                    id="inv-avatar"
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg (optional)"
                    className="h-11 rounded-xl bg-secondary/50 border-border/50"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={creating}
                    className="gap-2 rounded-xl btn-primary-gradient px-8"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending Invite...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send Invite
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowCreateForm(false)}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* User list */}
          <div className="glass-strong rounded-2xl border border-border/50 shadow-elevated overflow-hidden">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading users...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No users found. Invite your first user above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">User</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Role</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3 hidden md:table-cell">Hospital(s)</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3 hidden sm:table-cell">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {users.map((u) => (
                      <tr key={u.user_id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold flex-shrink-0">
                              {u.full_name?.[0]?.toUpperCase() || u.email[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{u.full_name || 'Unnamed'}</p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-2 py-1 rounded-full border font-medium uppercase tracking-wider ${getRoleBadgeClass(u.role)}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          {u.hospitals.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.hospitals.map((h) => (
                                <span
                                  key={h.hospital_id}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border"
                                >
                                  {h.hospital_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
