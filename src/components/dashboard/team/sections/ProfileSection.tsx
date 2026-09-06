"use client";

import { useState } from "react";
import type { ProfileRow, TeamRow, ApprovalRequestRow, RoomRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";
import { submitTeamEditRequest, DashboardActionError } from "@/lib/dashboard/team-actions";
import {
  GENDER_OPTIONS,
  GRADUATION_OPTIONS,
  SCHOOL_OPTIONS,
  STAY_OPTIONS,
  branchesFor,
  departmentsFor,
  programsFor,
  yearsFor,
} from "@/lib/registration/academic";

interface EditableMember {
  profileId: string;
  name: string;
  phone: string;
  graduation: string;
  program: string;
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
    graduation: m.graduation ?? "",
    program: m.program ?? "",
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
                <DepSelect
                  label="Graduation"
                  value={m.graduation}
                  placeholder="Select Graduation"
                  options={[...GRADUATION_OPTIONS]}
                  onChange={(v) => updateMember(m.profileId, { graduation: v, program: "", yearOfStudy: "" })}
                />
                <DepSelect
                  label="Program"
                  value={m.program}
                  placeholder="Select Program"
                  options={programsFor(m.graduation)}
                  disabled={!m.graduation}
                  onChange={(v) => updateMember(m.profileId, { program: v, yearOfStudy: "" })}
                />
                <DepSelect
                  label="Year of Study"
                  value={m.yearOfStudy}
                  placeholder="Select Year of Study"
                  options={yearsFor(m.program)}
                  disabled={!m.program}
                  onChange={(v) => updateMember(m.profileId, { yearOfStudy: v })}
                />
                <DepSelect
                  label="School"
                  value={m.school}
                  placeholder="Select School"
                  options={[...SCHOOL_OPTIONS]}
                  onChange={(v) => updateMember(m.profileId, { school: v, department: "", branch: "" })}
                />
                <DepSelect
                  label="Department"
                  value={m.department}
                  placeholder="Select Department"
                  options={departmentsFor(m.school)}
                  disabled={!m.school}
                  onChange={(v) => updateMember(m.profileId, { department: v, branch: "" })}
                />
                <DepSelect
                  label="Branch"
                  value={m.branch}
                  placeholder="Select Branch"
                  options={branchesFor(m.department)}
                  disabled={!m.department}
                  onChange={(v) => updateMember(m.profileId, { branch: v })}
                />
                <DepSelect
                  label="Gender"
                  value={m.gender}
                  placeholder="Select Gender"
                  options={[...GENDER_OPTIONS]}
                  onChange={(v) => updateMember(m.profileId, { gender: v })}
                />
                <DepSelect
                  label="Stay"
                  value={m.stay}
                  placeholder="Select Stay"
                  options={[...STAY_OPTIONS]}
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
                <Info label="Graduation" value={m.graduation ?? "—"} />
                <Info label="Program" value={m.program ?? "—"} />
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

function DepSelect({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  // Show a legacy/out-of-list value so the Team Lead can see and change it.
  const isLegacy = value !== "" && !options.includes(value);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold disabled:opacity-50"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {isLegacy && <option value={value}>{value} (current — not in list)</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
