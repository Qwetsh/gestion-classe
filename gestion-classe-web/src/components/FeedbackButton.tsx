import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type FeedbackType = 'bug' | 'suggestion' | 'autre';

export function FeedbackButton() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState<FeedbackType>('suggestion');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!user || !message.trim()) return;
    setIsSending(true);
    try {
      const { error } = await supabase.from('feedbacks').insert({
        user_id: user.id,
        user_email: user.email,
        type,
        message: message.trim(),
      });
      if (error) throw error;
      setSent(true);
      setTimeout(() => {
        setShowModal(false);
        setSent(false);
        setMessage('');
        setType('suggestion');
      }, 1500);
    } catch (err) {
      console.error('Error sending feedback:', err);
      alert('Erreur lors de l\'envoi du feedback');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full text-white flex items-center justify-center transition-all hover:scale-110 hover:shadow-xl"
        style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
        title="Envoyer un retour"
      >
        <span className="text-2xl">💬</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-[var(--color-surface)] w-full max-w-md overflow-hidden"
            style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}
          >
            {/* Header */}
            <div
              className="p-5"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Votre retour</h3>
                <button
                  onClick={() => { setShowModal(false); setSent(false); }}
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/20 transition-colors text-white"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  ✕
                </button>
              </div>
              <p className="text-white/70 text-sm mt-1">Aidez-nous a ameliorer l'application</p>
            </div>

            {sent ? (
              <div className="p-8 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-lg font-semibold text-[var(--color-text)]">Merci pour votre retour !</p>
              </div>
            ) : (
              <>
                <div className="p-5 space-y-4">
                  {/* Type selector */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Type</label>
                    <div className="flex gap-2">
                      {([
                        { value: 'bug' as FeedbackType, label: '🐛 Bug', color: 'var(--color-error)' },
                        { value: 'suggestion' as FeedbackType, label: '💡 Suggestion', color: 'var(--color-primary)' },
                        { value: 'autre' as FeedbackType, label: '💬 Autre', color: 'var(--color-text-secondary)' },
                      ]).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setType(opt.value)}
                          className={`flex-1 py-2 px-3 text-sm font-medium border-2 transition-all ${
                            type === opt.value
                              ? 'text-white'
                              : 'text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
                          }`}
                          style={{
                            borderRadius: 'var(--radius-lg)',
                            ...(type === opt.value ? { background: opt.color, borderColor: opt.color } : {}),
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Message</label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={type === 'bug' ? 'Decrivez le probleme rencontre...' : 'Votre idee ou commentaire...'}
                      rows={4}
                      className="w-full px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--color-border)] flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors font-medium"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSending || !message.trim()}
                    className="flex-1 px-4 py-2.5 text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }}
                  >
                    {isSending ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
