import type { ReactNode } from "react";
import Link from "next/link";
import SiteMotion from "./site-motion";

const navigation = [
  ["01", "サービス", "/services"],
  ["02", "私たちについて", "/company"],
  ["03", "制作事例", "/works"],
  ["04", "コラム", "/blog"],
];

export const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 10h11M11 5l5 5-5 5" />
  </svg>
);

export const Logo = ({ footer = false }: { footer?: boolean }) => (
  <Link className={`logo${footer ? " footer-logo" : ""}`} href="/" aria-label="REVANS トップへ">
    <span className="logo-mark" aria-hidden="true"><b>R</b><i /></span>
    <span className="logo-type"><strong>REVANS</strong><small>DIGITAL CRAFT</small></span>
  </Link>
);

export function SiteHeader({ active }: { active?: string }) {
  return (
    <header className="site-header">
      <div className="header-inner shell">
        <Logo />
        <nav className="desktop-nav" aria-label="メインナビゲーション">
          {navigation.map(([number, label, href]) => (
            <Link key={href} className={active === href ? "is-active" : ""} href={href} data-index={number}>{label}</Link>
          ))}
        </nav>
        <Link className="header-cta" href="/contact">無料相談 <ArrowIcon /></Link>
        <details className="mobile-nav">
          <summary aria-label="メニューを開く"><span /><span /></summary>
          <nav>
            {navigation.map(([, label, href]) => <Link key={href} href={href}>{label}</Link>)}
            <Link href="/contact">無料相談する</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="shell footer-top">
        <div><Logo footer /><p>WebとAIで、事業が進む仕組みをつくる。</p></div>
        <div className="footer-nav">
          <Link href="/services">サービス</Link><Link href="/company">私たちについて</Link><Link href="/works">制作事例</Link><Link href="/blog">コラム</Link><Link href="/contact">お問い合わせ</Link>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© REVANS</span><span>東京都世田谷区 / 全国オンライン対応</span></div>
    </footer>
  );
}

export function SubpageFrame({ active, children }: { active?: string; children: ReactNode }) {
  return (
    <main className="subpage-main">
      <SiteMotion />
      <div className="page-grain" aria-hidden="true" />
      <div className="pointer-spotlight" aria-hidden="true" />
      <div className="cursor-ring" aria-hidden="true" />
      <div className="cursor-dot" aria-hidden="true" />
      <SiteHeader active={active} />
      {children}
      <SiteFooter />
    </main>
  );
}

export function PageIntro({ index, label, title, description, accent }: { index: string; label: string; title: ReactNode; description: string; accent: string }) {
  return (
    <section className="sub-hero">
      <div className="sub-hero-grid" aria-hidden="true" />
      <div className="sub-hero-orbit" aria-hidden="true"><span>R</span></div>
      <div className="sub-hero-word" aria-hidden="true">{accent}</div>
      <div className="shell sub-hero-inner">
        <div className="sub-hero-meta"><span>R/{index}</span><i /><small>REVANS DIGITAL CRAFT</small></div>
        <p className="eyebrow"><span /> {label}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="sub-hero-foot shell"><span>TOKYO / JAPAN</span><span>WEB × AI × SYSTEM</span></div>
    </section>
  );
}

export function SubpageCTA({ title = "まだ言葉になっていない課題から、一緒に整理します。" }: { title?: string }) {
  return (
    <section className="sub-cta">
      <div className="sub-cta-word" aria-hidden="true">REVANS</div>
      <div className="shell sub-cta-inner" data-reveal="up">
        <p className="eyebrow light"><span /> LET&apos;S TALK</p>
        <h2>{title}</h2>
        <p>Web・AI・業務改善の相談を、現在の状況から整理します。</p>
        <Link className="button contact-button" href="/contact">無料で相談する <ArrowIcon /></Link>
      </div>
    </section>
  );
}
