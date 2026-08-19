import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon, PageIntro, SubpageCTA, SubpageFrame } from "../site-chrome";
import { services, serviceDetails } from "@/lib/data";

const DESC =
  "Web制作、AIシステム、業務自動化、集客・採用支援を一体で支援するREVANSのサービス。LP・ホームページ制作、MEO、AIブログ、広告運用、AI業務改善、採用支援まで。";

export const metadata: Metadata = {
  title: "サービス",
  description: DESC,
  alternates: { canonical: "/services" },
  openGraph: { url: "/services", title: "サービス｜REVANS", description: DESC },
};

// 実データ（lib/data）を参照元の detail-service レイアウトへマッピング。
// タイトルは各サービス詳細ページ（/services/[slug]）へのリンクにして内部導線を維持する。
const detailList = services.map((card) => {
  const detail = serviceDetails.find((d) => d.slug === card.slug)!;
  return {
    number: card.no,
    slug: card.slug,
    label: detail.en,
    title: detail.title,
    lead: detail.description,
    fit: detail.issues[0]?.title ?? card.body,
    deliverables: detail.features.map((f) => f.title),
  };
});

const steps = [
  ["01", "HEAR", "状況を整理", "目標、現場の流れ、困っていることを言葉にします。"],
  ["02", "DESIGN", "必要な形を設計", "優先順位を決め、画面と仕組みをわかりやすく設計します。"],
  ["03", "BUILD", "制作・実装", "途中経過を共有しながら、使えるところまで仕上げます。"],
  ["04", "GROW", "運用・改善", "公開後の状況を確認し、必要な改善を重ねます。"],
];

export default function ServicesPage() {
  return (
    <SubpageFrame active="/services">
      <PageIntro index="01" label="SERVICES" accent="CAPABILITIES" title={<>事業を動かすものを、<br /><em>ひとつのチームで。</em></>} description="見せるWebサイトから、裏側で動くAI・業務システム、公開後の集客・採用まで。課題に合わせて必要な支援を組み合わせます。" />

      <section className="content-section">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>01 — 06</span><div><p>OUR CAPABILITIES</p><h2>必要なところから、<br />小さく始められます。</h2></div></div>
          <div className="detail-service-list">
            {detailList.map((service) => (
              <article className="detail-service" key={service.number} data-reveal="up">
                <div className="detail-service-index"><span>{service.number}</span><small>{service.label}</small></div>
                <div className="detail-service-copy">
                  <h2><Link href={`/services/${service.slug}`}>{service.title}</Link></h2>
                  <p>{service.lead}</p>
                  <div className="service-fit"><small>こんな課題に</small><strong>{service.fit}</strong></div>
                  <Link className="text-link" href={`/services/${service.slug}`}>詳しく見る <ArrowIcon /></Link>
                </div>
                <ul>{service.deliverables.map((item) => <li key={item}>{item}<ArrowIcon /></li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="dark-feature">
        <div className="dark-feature-r" aria-hidden="true">R</div>
        <div className="shell dark-feature-inner" data-reveal="up">
          <p>ONE TEAM, ONE SYSTEM</p>
          <h2>WEBだけでも、<br />SYSTEMだけでもない。</h2>
          <div><span>見える体験</span><i /> <span>裏側の仕組み</span><i /> <span>公開後の改善</span></div>
        </div>
      </section>

      <section className="content-section process-detail" id="process">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>04 STEPS</span><div><p>PROCESS</p><h2>相談から運用まで、<br />迷わない進め方。</h2></div></div>
          <div className="sub-step-grid" data-reveal="up">
            {steps.map(([number, label, title, description]) => <article key={number}><div><b>{number}</b><small>{label}</small></div><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>
      <SubpageCTA title="何から始めるべきか、そこから一緒に整理します。" />
    </SubpageFrame>
  );
}
