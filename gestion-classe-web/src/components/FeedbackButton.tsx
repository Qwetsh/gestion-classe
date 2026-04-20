import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useUIFeedback } from '../contexts/UIFeedbackContext';

type FeedbackType = 'bug' | 'suggestion' | 'autre';

export function FeedbackButton() {
  const { user } = useAuth();
  const { toast } = useUIFeedback();
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
      toast('Erreur lors de l\'envoi du feedback');
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
        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 4px 20px rgba(99, 102, 241, 0.25)' }}
        title="Envoyer un retour"
      >
        <span className="text-2xl">💬</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-[var(--surface)] w-full max-w-md overflow-hidden"
            style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }}
          >
            {/* Header */}
            <div
              className="p-5"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Votre retour</h3>
                <button
                  onClick={() => { setShowModal(false); setSent(false); }}
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/20 transition-colors text-white"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  ✕
                </button>
              </div>
              <p className="text-white/70 text-sm mt-1">Aidez-nous a ameliorer l'application</p>
            </div>

            {sent ? (
              <div className="p-8 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-lg font-semibold text-[var(--text)]">Merci pour votre retour !</p>
              </div>
            ) : (
              <>
                <div className="p-5 space-y-4">
                  {/* Type selector */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Type</label>
                    <div className="flex gap-2">
                      {([
                        { value: 'bug' as FeedbackType, label: '🐛 Bug', color: 'var(--neg)' },
                        { value: 'suggestion' as FeedbackType, label: '💡 Suggestion', color: 'var(--indigo)' },
                        { value: 'autre' as FeedbackType, label: '💬 Autre', color: 'var(--text-muted)' },
                      ]).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setType(opt.value)}
                          className={`flex-1 py-2 px-3 text-sm font-medium border-2 transition-all ${
                            type === opt.value
                              ? 'text-white'
                              : 'text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--indigo)]'
                          }`}
                          style={{
                            borderRadius: 'var(--radius)',
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
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Message</label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={type === 'bug' ? 'Decrivez le probleme rencontre...' : 'Votre idee ou commentaire...'}
                      rows={4}
                      className="w-full px-4 py-3 bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] resize-none"
                      style={{ borderRadius: 'var(--radius)' }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--border)] flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors font-medium"
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSending || !message.trim()}
                    className="flex-1 px-4 py-2.5 text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius)' }}
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
