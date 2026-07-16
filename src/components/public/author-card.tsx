import { PostImage } from "./post-image";

type AuthorProfile = {
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  expertise: string | null;
  publicEmail: string | null;
  website: string | null;
  twitter: string | null;
  instagram: string | null;
  telegram: string | null;
  linkedin: string | null;
};

const SOCIALS: { key: keyof AuthorProfile; label: string }[] = [
  { key: "website", label: "وب‌سایت" },
  { key: "twitter", label: "ایکس" },
  { key: "instagram", label: "اینستاگرام" },
  { key: "telegram", label: "تلگرام" },
  { key: "linkedin", label: "لینکدین" },
];

export function AuthorCard({ profile, fallbackName = "نویسنده" }: { profile: AuthorProfile; fallbackName?: string }) {
  const name = profile.displayName || fallbackName;
  return (
    <header className="author-card">
      <div className="author-card-avatar relative">
        {profile.avatarUrl ? (
          <PostImage src={profile.avatarUrl} alt={`تصویر ${name}`} sizes="112px" />
        ) : <span aria-hidden="true">{name.slice(0, 1)}</span>}
      </div>
      <div>
        <p className="author-card-label">نویسنده</p>
        <h1>{name}</h1>
        {profile.expertise && <p className="author-card-expertise">{profile.expertise}</p>}
        {profile.bio && <p className="author-card-bio">{profile.bio}</p>}
        <nav aria-label="راه‌های ارتباطی عمومی نویسنده">
          {profile.publicEmail && <a href={`mailto:${profile.publicEmail}`}>ایمیل عمومی</a>}
          {SOCIALS.map(({ key, label }) => {
            const value = profile[key];
            return typeof value === "string" && /^https?:\/\//i.test(value) ? (
              <a key={key} href={value} target="_blank" rel="noopener noreferrer">{label}</a>
            ) : null;
          })}
        </nav>
      </div>
    </header>
  );
}
