import React from "react";
import { Crown, Users } from "lucide-react";
import { Badge, Card, EmptyState, Monogram, Page } from "@/components/ui";
import { useSession } from "@/lib/session";

const TONES = ["navy", "plum", "green", "amber", "gold", "rust"];

/**
 * Roles: who owns what, so nobody has to ask who handles a member question,
 * a refund or a Discord post. Read from `cc_team`; the Team Board (Phase 2)
 * adds the tasks, streaks and shout outs on top of these lanes.
 */
export default function Team() {
  const { team, me } = useSession();
  const people = team.filter((person) => person.active !== false);
  return (
    <Page title="Roles" subtitle={`${people.length} ${people.length === 1 ? "person" : "people"} · who owns what`}>
      {people.length ? (
        <div className="cc-grid-3">
          {people.map((person, i) => (
            <Card key={person.email}>
              <div className="flex items-center" style={{ gap: 12, marginBottom: 8 }}>
                <Monogram name={person.name} tone={TONES[i % TONES.length]} size={44} />
                <div className="min-w-0" style={{ flex: 1 }}>
                  <p className="t-headline cc-label cc-clip">
                    {person.name}
                    {person.email === me?.email ? <span className="t-cap1 cc-tertiary"> · you</span> : null}
                  </p>
                  <p className="t-foot cc-tertiary cc-clip">{person.lane || "No lane yet"}</p>
                </div>
                {person.is_admin ? (
                  <Badge tone="gold" title="Can change settings and see a member's address">
                    Admin
                  </Badge>
                ) : null}
              </div>
              {(person.responsibilities || []).length ? (
                <ul className="cc-rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {person.responsibilities.map((item) => (
                    <li key={item} className="t-foot cc-secondary flex items-center gap-2" style={{ padding: "7px 0" }}>
                      <span className={`tone-${TONES[i % TONES.length]}`} style={{ width: 6, height: 6, borderRadius: 3, background: "var(--tone)", flexShrink: 0 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="t-foot cc-tertiary" style={{ padding: "6px 0" }}>
                  No responsibilities listed yet.
                </p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Users} title="No team yet." sub="Add the team in Supabase with supabase/seed-team.sql, then sign in again." />
        </Card>
      )}
      <p className="t-cap1 cc-tertiary flex items-center gap-2" style={{ padding: "0 4px" }}>
        <Crown size={13} aria-hidden="true" /> Lanes are edited in Supabase for now. The Team Board brings tasks, streaks and shout outs in Phase 2.
      </p>
    </Page>
  );
}
