'use client';

import { useState } from 'react';
import { GraduationCap, Plus, X } from 'lucide-react';
import { api, Specialty } from '@/lib/api';

interface AdminSpecialtiesPanelProps {
  specialties: Specialty[];
  onRefresh: () => void;
  onError: (message: string) => void;
}

export function AdminSpecialtiesPanel({ specialties, onRefresh, onError }: AdminSpecialtiesPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Specialty | null>(null);
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setSortOrder(String((specialties.length + 1) * 10));
    setShowForm(true);
  };

  const openEdit = (item: Specialty) => {
    setEditing(item);
    setName(item.name);
    setSortOrder(String(item.sortOrder));
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    onError('');
    try {
      const payload = { name: name.trim(), sortOrder: parseInt(sortOrder, 10) || 0 };
      if (editing) {
        await api.updateSpecialty(editing.id, payload);
      } else {
        await api.createSpecialty(payload);
      }
      setShowForm(false);
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: Specialty) => {
    setTogglingId(item.id);
    onError('');
    try {
      await api.updateSpecialty(item.id, { isActive: !item.isActive });
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Holatni o\'zgartirishda xatolik');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (item: Specialty) => {
    if (!confirm(`"${item.name}" yo'nalishini o'chirishni tasdiqlaysizmi?`)) return;
    onError('');
    try {
      await api.deleteSpecialty(item.id);
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'O\'chirishda xatolik');
    }
  };

  return (
    <>
      <div className="panel overflow-hidden animate-slide-up">
        <div className="panel-header bg-gradient-to-r from-slate-50 to-transparent">
          <GraduationCap size={18} className="text-brand-600" />
          <span className="panel-title">Yo&apos;nalishlar ({specialties.length})</span>
          <button type="button" onClick={openCreate} className="ml-auto btn-primary !py-1.5 !text-xs">
            <Plus size={14} /> Yangi yo&apos;nalish
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Tartib</th>
                <th>Holat</th>
                <th className="text-right">Amal</th>
              </tr>
            </thead>
            <tbody>
              {specialties.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold text-slate-800">{s.name}</td>
                  <td className="text-slate-500">{s.sortOrder}</td>
                  <td>
                    <span className={`status-badge ${s.isActive ? 'status-in-progress' : 'bg-red-50 text-red-700 ring-red-200/60'}`}>
                      {s.isActive ? 'Faol' : 'Nofaol'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(s)} className="text-xs font-medium text-brand-600 hover:bg-brand-50 px-2 py-1.5 rounded-lg">
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        disabled={togglingId === s.id}
                        onClick={() => toggleActive(s)}
                        className="text-xs font-medium text-slate-600 hover:bg-slate-50 px-2 py-1.5 rounded-lg"
                      >
                        {togglingId === s.id ? '...' : s.isActive ? 'O\'chirish' : 'Faollashtirish'}
                      </button>
                      <button type="button" onClick={() => handleDelete(s)} className="text-xs font-medium text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg">
                        O&apos;chirish
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {specialties.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-500 py-8">
                    Yo&apos;nalishlar hali qo&apos;shilmagan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="panel p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-900">{editing ? 'Yo\'nalishni tahrirlash' : 'Yangi yo\'nalish'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Nomi</label>
                <input className="form-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Terapevt" />
              </div>
              <div>
                <label className="label">Tartib raqami</label>
                <input type="number" className="form-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Bekor</button>
                <button type="submit" disabled={saving} className="gradient-btn flex-1 disabled:opacity-50">
                  {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
