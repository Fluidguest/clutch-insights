import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield, UserPlus, Trash2, Crown } from 'lucide-react';

interface UserWithRole {
  id: string;
  email: string;
  role: 'admin' | 'user' | null;
}

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email');

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role');

    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
    const userList = (profiles || []).map(p => ({
      id: p.id,
      email: p.email || 'Sem email',
      role: (roleMap.get(p.id) as 'admin' | 'user') || null,
    }));
    setUsers(userList);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const toggleAdmin = async (userId: string, currentRole: string | null) => {
    if (currentRole === 'admin') {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');
      if (error) { toast.error('Erro ao remover admin'); return; }
      toast.success('Admin removido');
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });
      if (error) { toast.error('Erro ao adicionar admin'); return; }
      toast.success('Admin adicionado');
    }
    loadUsers();
  };

  if (!isAdmin) {
    return (
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Shield className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-lg font-medium">Acesso restrito</p>
          <p className="text-sm mt-1">Apenas administradores podem acessar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Administração</h1>
      </div>

      <div className="bg-card rounded-lg p-4 border border-border mb-4">
        <h2 className="font-semibold text-sm mb-1">Controle de Acesso</h2>
        <p className="text-xs text-muted-foreground mb-3">
          <strong>Admin:</strong> vê todos os registros de todos os usuários.
          <br />
          <strong>Usuário comum:</strong> vê apenas seus próprios registros.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-10">Carregando...</p>
      ) : (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm mb-2">Usuários ({users.length})</h2>
          {users.map(u => (
            <div key={u.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
              u.role === 'admin' ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
            }`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                u.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                {u.role === 'admin' ? <Crown className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.email}</p>
                <p className="text-xs text-muted-foreground">
                  {u.role === 'admin' ? 'Administrador' : 'Usuário comum'}
                  {u.id === user?.id ? ' (você)' : ''}
                </p>
              </div>
              {u.id !== user?.id && (
                <Button
                  size="sm"
                  variant={u.role === 'admin' ? 'destructive' : 'default'}
                  onClick={() => toggleAdmin(u.id, u.role)}
                  className="shrink-0 h-8 text-xs"
                >
                  {u.role === 'admin' ? 'Remover' : 'Tornar Admin'}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
