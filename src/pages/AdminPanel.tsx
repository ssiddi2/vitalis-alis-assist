import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Shield, UserPlus, Users, ArrowLeft, Mail, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { EditUserModal } from '@/components/virtualis/EditUserModal';
import { TableRowSkeleton } from '@/components/ui/skeleton-patterns';
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

const USERS_PER_PAGE = 20;

export default function AdminPanel() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Edit modal
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('clinician');
  const [selectedHospitalIds, setSelectedHospitalIds] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [creating, setCreating] = useState(false);

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

  // Filtered & paginated users
  const filteredUsers = useMemo(() => {
    let result = users;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }
    return result;
  }, [users, searchQuery, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, roleFilter]);

  const toggleHospital = (id: string) => {
    setSelectedHospitalIds(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]);
  };

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
          hospital_ids: selectedHospitalIds.length > 0 ? selectedHospitalIds : undefined,
          avatar_url: avatarUrl.trim() || undefined,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`Invitation sent to ${email}`);
      setEmail(''); setFullName(''); setRole('clinician'); setSelectedHospitalIds([]); setAvatarUrl('');
      setShowCreateForm(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2 rounded-xl">
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
          <img src={alisLogo} alt="ALIS" className="h-8" />
        </header>

        {/* Content */}
        <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
          {/* Actions bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">Users ({filteredUsers.length})</h2>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)} className="gap-2 rounded-xl btn-primary-gradient">
              <UserPlus className="w-4 h-4" />
              Invite User
            </Button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-secondary/50 border-border/50"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40 h-10 rounded-xl bg-secondary/50 border-border/50">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="clinician">Clinician</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
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
                  <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="provider@hospital.com" className="h-11 rounded-xl bg-secondary/50 border-border/50" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-name" className="text-sm font-medium">Full Name *</Label>
                  <Input id="inv-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Smith" className="h-11 rounded-xl bg-secondary/50 border-border/50" required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Role *</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinician">Clinician</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hospitals</Label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-xl bg-secondary/30 p-2 border border-border/50">
                    {hospitals.map((h) => (
                      <label key={h.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors text-sm">
                        <Checkbox checked={selectedHospitalIds.includes(h.id)} onCheckedChange={() => toggleHospital(h.id)} />
                        {h.name} <span className="text-[10px] text-muted-foreground ml-auto">{h.code}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inv-avatar" className="text-sm font-medium">Avatar URL</Label>
                  <Input id="inv-avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg (optional)" className="h-11 rounded-xl bg-secondary/50 border-border/50" />
                </div>
                <div className="sm:col-span-2 flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={creating} className="gap-2 rounded-xl btn-primary-gradient px-8">
                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Sending Invite...</> : <><Mail className="w-4 h-4" />Send Invite</>}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)} className="rounded-xl">Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {/* User list */}
          <div className="glass-strong rounded-2xl border border-border/50 shadow-elevated overflow-hidden">
            {loadingUsers ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">User</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Role</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3 hidden md:table-cell">Hospital(s)</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3 hidden sm:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} columns={4} />)}
                </tbody>
              </table>
            ) : paginatedUsers.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || roleFilter !== 'all' ? 'No users match your filters.' : 'No users found. Invite your first user above.'}
                </p>
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
                    {paginatedUsers.map((u) => (
                      <tr
                        key={u.user_id}
                        onClick={() => setEditUser(u)}
                        className="hover:bg-secondary/20 transition-colors cursor-pointer"
                      >
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
                                <span key={h.hospital_id} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                                  {h.hospital_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-secondary/10">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 w-8 p-0 rounded-lg">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 w-8 p-0 rounded-lg">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Edit User Modal */}
      <EditUserModal
        user={editUser}
        hospitals={hospitals}
        open={!!editUser}
        onOpenChange={(open) => { if (!open) setEditUser(null); }}
        onUpdated={fetchUsers}
      />
    </div>
  );
}
