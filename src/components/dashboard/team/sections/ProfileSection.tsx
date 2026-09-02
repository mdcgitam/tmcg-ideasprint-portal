"use client";

import { useState } from "react";
import type { ProfileRow, TeamRow, ApprovalRequestRow, RoomRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";
import { submitTeamEditRequest, DashboardActionError } from "@/lib/dashboard/team-actions";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];
const STAY_OPTIONS = ["Hosteller", "Day Scholar"];

interface EditableMember {
  profileId: string;
  name: string;
  phone: string;
  yearOfStudy: string;
  school: string;
  department: string;
  branch: string;
  gender: string;
  stay: string;
}

function toEditable(members: TeamMemberProfile[]): EditableMember[] {
  return members.map((m) => ({
    profileId: m.id,
    name: m.name,
    phone: m.phone,
    yearOfStudy: m.year_of_study,
    school: m.school,
    department: m.department,
    branch: m.branch,
    gender: m.gender,
    stay: m.stay,
  }));
}

/**
 * SPEC §22/24-26: edits are Team Lead only, User ID/Team ID never editable,
 * and every edit goes to Pending Approval rather than applying immediately.
 * Registration number and GITAM email are kept read-only here too — the
 * email is the account's login identity (matched at auth time), changing it
 * post-registration is out of scope for a simple edit-request flow.
 */
export function ProfileSection({
  profile,
  team,
  members,
  pendingApprovalRequest,
  isLead,
  room,
  zone,
  spocName,
}: {
  profile: ProfileRow;
  team: TeamRow;
  members: TeamMemberProfile[];
  pendingApprovalRequest: ApprovalRequestRow | null;
  isLead: boolean;
  room: RoomRow | null;
  zone: ZoneRow | null;
  spocName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [teamName, setTeamName] = useState(team.team_name);
  const [editedMembers, setEditedMembers] = useState<EditableMember[]>(() => toEditable(members));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  function updateMember(profileId: string, patch: Partial<EditableMember>) {
    setEditedMembers((prev) => prev.map((m) => (m.profileId === profileId ? { ...m, ...patch } : m)));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const currentSnapshot = { team: { teamName: team.team_name }, members: toEditable(members) };
      const requestedChanges = { team: { teamName }, members: editedMembers };
      await submitTeamEditRequest(team.id, currentSnapshot, requestedChanges);
      setJustSubmitted(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasPending = !!pendingApprovalRequest || justSubmitted;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 rounded-xl border border-border bg-surface p-6 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Team ID</span>
          <p className="mt-2 font-heading text-ink">{team.team_id}</p>
        </div>
        <div>
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Team Name</span>
          <p className="mt-2 font-heading text-ink">{team.team_name}</p>
        </div>
        <div>
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Status</span>
          <p className="mt-2 font-heading text-ink">{team.status}</p>
        </div>
        <div>
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Room</span>
          <p className="mt-2 font-heading text-ink">{room?.name ?? "Not yet assigned"}</p>
        </div>
        <div>
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Zone</span>
          <p className="mt-2 font-heading text-ink">{zone?.name ?? "—"}</p>
        </div>
        <div>
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">SPOC</span>
          <p className="mt-2 font-heading text-ink">{spocName ?? "Not yet assigned"}</p>
        </div>
      </div>

      {hasPending && (
        <div className="rounded-xl border border-gold/40 bg-gold/5 p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Pending Approval</span>
          <p className="mt-2 font-heading text-sm text-ink-muted">
            A team edit request is awaiting SPOC/Super Admin review. You can&apos;t submit another until this one is
            resolved.
          </p>
        </div>
      )}

      {isLead && !hasPending && !editing && (
        <button
          type="button"
          onClick={() => {
            setEditedMembers(toEditable(members));
            setTeamName(team.team_name);
            setEditing(true);
          }}
          className="w-fit rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light"
        >
          Request Changes
        </button>
      )}

      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface p-6">
            <label className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Team Name</label>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
            />
          </div>

          {editedMembers.map((m, i) => (
            <div key={m.profileId} className="rounded-xl border border-border bg-surface p-6">
              <p className="mb-4 font-heading text-sm text-gold">
                {i === 0 ? "Team Lead (You)" : `Member ${i + 1}`} · {members[i].user_id}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" value={m.name} onChange={(v) => updateMember(m.profileId, { name: v })} />
                <Field label="Phone" value={m.phone} onChange={(v) => updateMember(m.profileId, { phone: v })} />
                <SelectField
                  label="Year of Study"
                  value={m.yearOfStudy}
                  options={YEAR_OPTIONS}
                  onChange={(v) => updateMember(m.profileId, { yearOfStudy: v })}
                />
                <Field label="School" value={m.school} onChange={(v) => updateMember(m.profileId, { school: v })} />
                <Field
                  label="Department"
                  value={m.department}
                  onChange={(v) => updateMember(m.profileId, { department: v })}
                />
                <Field label="Branch" value={m.branch} onChange={(v) => updateMember(m.profileId, { branch: v })} />
                <SelectField
                  label="Gender"
                  value={m.gender}
                  options={GENDER_OPTIONS}
                  onChange={(v) => updateMember(m.profileId, { gender: v })}
                />
                <SelectField
                  label="Stay"
                  value={m.stay}
                  options={STAY_OPTIONS}
                  onChange={(v) => updateMember(m.profileId, { stay: v })}
                />
              </div>
            </div>
          ))}

          {error && <p className="font-heading text-sm text-danger">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit for Approval"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-border px-6 py-2.5 font-heading text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {members.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-surface p-6">
              <p className="mb-3 font-heading text-sm text-gold">
                {m.is_lead ? "Team Lead" : "Member"} · {m.user_id}
              </p>
              <div className="grid gap-3 font-heading text-sm text-ink sm:grid-cols-3">
                <Info label="Name" value={m.name} />
                <Info label="Reg No" value={m.reg_no} />
                <Info label="GITAM Mail" value={m.gitam_email} />
                <Info label="Phone" value={m.phone} />
                <Info label="Year" value={m.year_of_study} />
                <Info label="School" value={m.school} />
                <Info label="Department" value={m.department} />
                <Info label="Branch" value={m.branch} />
                <Info label="Gender" value={m.gender} />
                <Info label="Stay" value={m.stay} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-ink-faint uppercase">{label}</span>
      <p className="text-ink">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
