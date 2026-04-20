import { Suspense } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { tools, getToolById } from '../tools/registry';

function ToolGrid() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-[var(--text)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 40, letterSpacing: '-0.02em', fontStyle: 'italic' }}>Boite a outils</h1>
          <p className="text-[var(--text-muted)] mt-1">
            {tools.length} outils disponibles
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              to={`/tools/${tool.id}`}
              className="group p-5 bg-[var(--surface)] border border-[var(--border)] transition-all hover:shadow-lg hover:-translate-y-1 hover:border-[var(--indigo)]/30"
              style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center text-2xl mb-3"
                style={{ background: 'var(--indigo-soft)', borderRadius: 'var(--radius-sm)' }}
              >
                {tool.icon}
              </div>
              <h3 className="font-semibold text-[var(--text)] group-hover:text-[var(--indigo)] transition-colors">
                {tool.name}
              </h3>
              <p className="text-sm text-[var(--text-dim)] mt-1 line-clamp-2">{tool.description}</p>
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
          <p className="text-lg text-[var(--text-muted)]">Outil introuvable</p>
          <Link to="/tools" className="text-[var(--indigo)] mt-2 inline-block">
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
            className="w-9 h-9 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-colors"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            &larr;
          </button>
          <div
            className="w-10 h-10 flex items-center justify-center text-xl"
            style={{ background: 'var(--indigo-soft)', borderRadius: 'var(--radius-sm)' }}
          >
            {tool.icon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">{tool.name}</h1>
            <p className="text-sm text-[var(--text-dim)]">{tool.description}</p>
          </div>
        </div>

        {/* Tool content */}
        <div className="max-w-2xl">
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-3 border-[var(--indigo)] border-t-transparent rounded-full animate-spin" />
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
