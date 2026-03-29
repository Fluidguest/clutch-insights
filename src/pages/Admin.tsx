import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getPartsCatalog, addPart, updatePart, deletePart, type PartsCatalog } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield, UserPlus, Trash2, Crown, Plus, Edit2, Check, X } from 'lucide-react';

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
  const [parts, setParts] = useState<PartsCatalog[]>([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [newPartName, setNewPartName] = useState('');
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editingPartName, setEditingPartName] = useState('');
  const [savingPart, setSavingPart] = useState(false);

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

  const loadParts = async () => {
    setLoadingParts(true);
    try {
      const catalog = await getPartsCatalog();
      setParts(catalog);
    } catch (err) {
      console.error('Erro ao carregar peças:', err);
      toast.error('Erro ao carregar peças');
    } finally {
      setLoadingParts(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadParts();
  }, []);

  const toggleAdmin = async (userId: string, currentRole: string | null) => {
    if (currentRole === 'admin') {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');
      if (error) {
        toast.error('Erro ao remover admin');
        return;
      }
      toast.success('Admin removido');
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });
      if (error) {
        toast.error('Erro ao adicionar admin');
        return;
      }
      toast.success('Admin adicionado');
    }
    loadUsers();
  };

  const becomeAdmin = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: 'admin' });
    if (error) {
      toast.error('Não foi possível. Já existe um administrador.');
      return;
    }
    toast.success('Você agora é administrador!');
    window.location.reload();
  };

  const handleAddPart = async () => {
    if (!newPartName.trim()) {
      toast.error('Digite o nome da peça');
      return;
    }
    setSavingPart(true);
    try {
      await addPart(newPartName.trim());
      toast.success('Peça adicionada com sucesso!');
      setNewPartName('');
      loadParts();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar peça');
    } finally {
      setSavingPart(false);
    }
  };

  const handleEditPart = (part: PartsCatalog) => {
    setEditingPartId(part.id);
    setEditingPartName(part.name);
  };

  const handleSaveEdit = async () => {
    if (!editingPartId) return;
    if (!editingPartName.trim()) {
      toast.error('Digite o nome da peça');
      return;
    }
    setSavingPart(true);
    try {
      await updatePart(editingPartId, editingPartName.trim());
      toast.success('Peça atualizada com sucesso!');
      setEditingPartId(null);
      setEditingPartName('');
      loadParts();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar peça');
    } finally {
      setSavingPart(false);
    }
  };

  const handleDeletePart = async (partId: string) => {
    if (!confirm('Tem certeza que deseja remover esta peça?')) return;
    try {
      await deletePart(partId);
      toast.success('Peça removida com sucesso!');
      loadParts();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover peça');
    }
  };

  if (!isAdmin) {
    return (
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Shield className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-lg font-medium">Acesso restrito</p>
          <p className="text-sm mt-1">Apenas administradores podem acessar</p>
          <Button onClick={becomeAdmin} className="mt-4">
            Tornar-me Administrador
          </Button>
          <p className="text-xs mt-2 text-center">Disponível apenas se nenhum admin existir</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Administração</h1>
      </div>

      {/* Seção de Peças */}
      <div className="bg-card rounded-lg p-4 border border-border mb-6">
        <h2 className="font-semibold text-sm mb-3">Gerenciar Peças</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Adicione, edite ou remova as peças que aparecem ao criar novos discos.
        </p>

        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Nome da peça"
            value={newPartName}
            onChange={e => setNewPartName(e.target.value)}
            className="h-10 text-sm"
            onKeyPress={e => e.key === 'Enter' && handleAddPart()}
          />
          <Button
            onClick={handleAddPart}
            disabled={savingPart || !newPartName.trim()}
            size="sm"
            className="shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {loadingParts ? (
          <p className="text-center text-muted-foreground text-sm py-4">Carregando peças...</p>
        ) : (
          <div className="space-y-2">
            {parts.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">Nenhuma peça cadastrada</p>
            ) : (
              parts.map(part => (
                <div
                  key={part.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
                >
                  {editingPartId === part.id ? (
                    <>
                      <Input
                        value={editingPartName}
                        onChange={e => setEditingPartName(e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                      />
                      <Button
                        onClick={handleSaveEdit}
                        disabled={savingPart}
                        size="sm"
                        variant="default"
                        className="h-8 w-8 p-0"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => setEditingPartId(null)}
                        disabled={savingPart}
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1">{part.name}</span>
                      <Button
                        onClick={() => handleEditPart(part)}
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeletePart(part.id)}
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Seção de Controle de Acesso */}
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
            <div
              key={u.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                u.role === 'admin' ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  u.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                }`}
              >
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
