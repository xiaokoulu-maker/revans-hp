import type { Metadata } from "next";
import { PageIntro, SubpageFrame } from "../site-chrome";
import ContactForm from "@/components/contact/ContactForm";

const DESC = "Web制作、AIシステム、業務改善、集客・採用に関するREVANSへのご相談。オンラインで全国対応しています。";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: DESC,
  alternates: { canonical: "/contact" },
  openGraph: { url: "/contact", title: "お問い合わせ｜REVANS", description: DESC },
};

const inquiryTypes = [
  ["01", "WEB", "サイト・LPを作りたい", "新規制作、リニューアル、問い合わせ導線の改善。"],
  ["02", "AI", "AIを業務に取り入れたい", "チャット、文章作成、ナレッジ活用などの仕組み化。"],
  ["03", "SYSTEM", "手作業を減らしたい", "顧客・案件管理、営業進捗、レポートの効率化。"],
  ["04", "GROWTH", "集客・採用を改善したい", "広告、MEO、コンテンツ、採用支援を組み合わせた運用。"],
];

export default function ContactPage() {
  return (
    <SubpageFrame active="/contact">
      <PageIntro index="05" label="CONTACT" accent="LET'S TALK" title={<>まだ言葉になっていない<br /><em>課題から、相談を。</em></>} description="作りたいものが決まっていなくても問題ありません。現在の状況と、変えたいことから一緒に整理します。" />

      <section className="content-section contact-options-section">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>CONSULTATION</span><div><p>WHAT CAN WE TALK ABOUT?</p><h2>このような相談に、<br />対応しています。</h2></div></div>
          <div className="contact-option-grid" data-reveal="up">
            {inquiryTypes.map(([number, label, title, description]) => <article key={number}><div><span>{number}</span><small>{label}</small></div><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className="contact-gateway">
        <div className="contact-gateway-word" aria-hidden="true">CONTACT</div>
        <div className="shell contact-gateway-inner" data-reveal="up">
          <div>
            <p className="eyebrow light"><span /> START A CONVERSATION</p>
            <h2>まずは現在の状況を、<br />お聞かせください。</h2>
            <p>相談内容を確認したうえで、必要な進め方を整理します。オンラインで全国対応しています。フォームからお気軽にご連絡ください。</p>
          </div>
          <div className="contact-form-card">
            <ContactForm />
          </div>
        </div>
      </section>

      <section className="content-section contact-flow-section">
        <div className="shell contact-flow" data-reveal="up">
          <div><span>01</span><h3>フォーム送信</h3><p>相談したい内容を、わかる範囲でご入力ください。</p></div>
          <i />
          <div><span>02</span><h3>内容確認</h3><p>現在の状況と、必要な確認事項を整理します。</p></div>
          <i />
          <div><span>03</span><h3>オンライン相談</h3><p>課題と優先順位を確認し、進め方をご案内します。</p></div>
        </div>
      </section>
    </SubpageFrame>
  );
}
