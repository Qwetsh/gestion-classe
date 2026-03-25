import { Suspense } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { tools, getToolById } from '../tools/registry';

function ToolGrid() {
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Boîte à outils</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              to={`/tools/${tool.id}`}
              className="group p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] transition-all hover:scale-[1.02] hover:border-[var(--color-primary)]"
              style={{ boxShadow: 'var(--shadow-xs)' }}
            >
              <div className="text-3xl mb-3">{tool.icon}</div>
              <h3 className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                {tool.name}
              </h3>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function ToolView() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const tool = toolId ? getToolById(toolId) : undefined;

  if (!tool) {
    return (
      <Layout>
        <div className="text-center py-16">
          <p className="text-lg text-[var(--color-text-secondary)]">Outil introuvable</p>
          <Link to="/tools" className="text-[var(--color-primary)] mt-2 inline-block">
            Retour aux outils
          </Link>
        </div>
      </Layout>
    );
  }

  const Component = tool.component;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/tools')}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
          >
            &larr;
          </button>
          <span className="text-2xl">{tool.icon}</span>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{tool.name}</h1>
        </div>

        {/* Tool content */}
        <div className="max-w-2xl">
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
              </div>
            }
          >
            <Component />
          </Suspense>
        </div>
      </div>
    </Layout>
  );
}

export { ToolGrid, ToolView };
