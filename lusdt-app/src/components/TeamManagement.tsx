import { useState } from 'react';
import { useAdminContract } from '../hooks/useAdminContract';
import { Shield, Plus, X, UserCheck, AlertOctagon, CheckCircle } from 'lucide-react';

export function TeamManagement() {
    const { grantRole, revokeRole, loading, roles } = useAdminContract();
    const [newMemberAddress, setNewMemberAddress] = useState('');
    const [selectedRole, setSelectedRole] = useState('OPERATOR');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const ROLES = [
        { id: 'ADMIN', label: 'Administrator', desc: 'Full system access', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
        { id: 'OPERATOR', label: 'Operator', desc: 'Pause & Fees Management', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
        { id: 'MINTER', label: 'Minter (Bridge)', desc: 'Can mint tokens', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
        { id: 'AtaxManager', label: 'Tax Manager', desc: 'Can update taxes', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' }
    ];

    const handleGrant = async () => {
        if (!newMemberAddress) return;
        try {
            setFeedback(null);
            await grantRole(selectedRole, newMemberAddress);
            setFeedback({ type: 'success', message: `Role ${selectedRole} granted successfully to ${newMemberAddress.slice(0, 8)}...` });
            setNewMemberAddress('');
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || 'Failed to grant role' });
        }
    };

    const handleRevoke = async (role: string, address: string) => {
        if (!confirm(`Are you sure you want to REVOKE ${role} from ${address}?`)) return;
        try {
            setFeedback(null);
            await revokeRole(role, address);
            setFeedback({ type: 'success', message: `Role ${role} revoked from ${address.slice(0, 8)}...` });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || 'Failed to revoke role' });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">

            {/* Header */}
            <div className="flex items-start gap-3 mb-6 border-b border-zinc-800 pb-4">
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-sm">
                    <UserCheck size={20} className="text-zinc-100" />
                </div>
                <div>
                    <h3 className="text-lg font-bold font-mono text-zinc-100 tracking-tight">TEAM_MANAGEMENT</h3>
                    <p className="text-xs font-mono text-zinc-500">Assign roles and permissions to team members.</p>
                </div>
            </div>

            {/* Feedback Message */}
            {feedback && (
                <div className={`p-3 rounded-sm border flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-900/10 border-green-900/30 text-green-400' : 'bg-red-900/10 border-red-900/30 text-red-400'
                    }`}>
                    {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertOctagon size={16} />}
                    <span className="text-xs font-mono">{feedback.message}</span>
                </div>
            )}

            {/* Add Member Form */}
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm">
                <h4 className="text-xs font-mono text-zinc-400 mb-6 uppercase border-b border-zinc-900 pb-2">Grant New Access</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-mono text-zinc-500 uppercase">Wallet Address</label>
                        <input
                            type="text"
                            value={newMemberAddress}
                            onChange={(e) => setNewMemberAddress(e.target.value)}
                            placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-sm px-3 py-2 text-sm font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-mono text-zinc-500 uppercase">Role Type</label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-sm px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors appearance-none"
                        >
                            {ROLES.map(r => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleGrant}
                        disabled={loading || !newMemberAddress}
                        className="flex items-center gap-2 px-6 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 font-mono text-xs font-bold rounded-sm uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={14} />
                        AUTHORIZE ACCESS
                    </button>
                </div>
            </div>

            {/* Roles Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {ROLES.map((role) => (
                    <div key={role.id} className={`p-4 rounded-sm border ${role.border} ${role.bg}`}>
                        <div className={`text-xs font-bold font-mono ${role.color} mb-1`}>{role.label.toUpperCase()}</div>
                        <p className="text-[10px] text-zinc-500 font-mono leading-tight">{role.desc}</p>
                    </div>
                ))}
            </div>

            {/* Active Members List (Simulation for MVP as contract doesn't enumerate) */}
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm opacity-70">
                <h4 className="text-xs font-mono text-zinc-500 mb-4 uppercase">Active Permissions (Cached)</h4>
                <p className="text-[10px] text-zinc-600 font-mono mb-4">
                    Note: This list shows recently modified permissions in this session. Re-query blockchain to verify exact state.
                </p>

                {/* Placeholder for list */}
                <div className="text-center py-8 text-zinc-700 text-xs font-mono border border-dashed border-zinc-800 rounded-sm">
                    No recent permission changes logged in session.
                </div>
            </div>

        </div>
    );
}
