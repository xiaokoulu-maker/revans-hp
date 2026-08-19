import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowIcon, PageIntro, SubpageCTA, SubpageFrame } from '../../site-chrome';
import { services, serviceDetails, getServiceDetail, getServiceSummary } from '@/lib/data';

// 6件を静的生成
export function generateStaticParams() {
  return serviceDetails.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = getServiceDetail(slug);
  if (!d) return {};
  const title = `${d.title}`;
  const url = `/services/${d.slug}`;
  return {
    title,
    description: d.description,
    alternates: { canonical: url },
    openGraph: { url, title: `${title}｜REVANS`, description: d.description },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = getServiceDetail(slug);
  if (!d) notFound();

  const index = services.find((s) => s.slug === d.slug)?.no ?? '01';
  const related = d.related.map((s) => getServiceSummary(s));

  return (
    <SubpageFrame active="/services">
      <PageIntro
        index={index}
        label={d.en}
        accent="CAPABILITIES"
        title={d.title}
        description={d.description}
      />

      {/* ISSUES */}
      <section className="content-section">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>ISSUES</span><div><p>こんなお悩みはありませんか？</p><h2>その課題、<br />設計から見直せます。</h2></div></div>
          <div className="model-grid" data-reveal="up">
            {d.issues.map((it, i) => (
              <article key={it.title}>
                <span>0{i + 1}</span>
                <small>ISSUE</small>
                <h3>{it.title}</h3>
                <p>{it.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT WE DO */}
      <section className="content-section journal-index-section">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>WHAT WE DO</span><div><p>REVANSが提供すること</p><h2>成果から逆算した、<br />4つの打ち手。</h2></div></div>
          <div className="value-grid" data-reveal="up">
            {d.features.map((f) => (
              <article key={f.no}>
                <div><span>{f.no}</span><small>SERVICE</small></div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                <b aria-hidden="true">R</b>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section className="content-section">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>FLOW</span><div><p>進め方</p><h2>相談から運用まで、<br />迷わない進め方。</h2></div></div>
          <div className="sub-step-grid" data-reveal="up">
            {d.flow.map((s, i) => (
              <article key={s.title}>
                <div><b>{String(i + 1).padStart(2, '0')}</b><small>STEP</small></div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
          <p className="model-note">{d.note}</p>
        </div>
      </section>

      <SubpageCTA title="何から始めるべきか、そこから一緒に整理します。" />

      {/* OTHER SERVICES */}
      <section className="content-section">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>OTHER SERVICES</span><div><p>あわせて検討されるサービス</p><h2>組み合わせて、<br />効果を最大化する。</h2></div></div>
          <div className="related-grid-3" data-reveal="up">
            {related.map((r) => (
              <Link className="related-card" href={`/services/${r.slug}`} key={r.slug}>
                <small className="font-en">{r.en}</small>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
                <b>サービス詳細 <ArrowIcon /></b>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SubpageFrame>
  );
}
