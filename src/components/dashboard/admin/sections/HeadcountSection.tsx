"use client";

import { useState } from "react";
import type { CampusCode, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { CAMPUS_ORDER } from "@/lib/dashboard/campus-config";
import { downloadCsv } from "@/lib/csv";

/**
 * Read-only headcount summary by Zone and by Venue — a different grain than
 * a team list (aggregated, not per-team). "People" counts active members
 * only, matching the Team Size convention used everywhere else, and only
 * active (non-no-show) teams contribute (0073). Originally Rooms and
 * Venues' own "Headcount" tab; moved here so Overview can be the one place
 * with every count instead of duplicating it in two places.
 */
export function HeadcountSection({
  rooms,
  zones,
  teams,
  membersByTeam,
  staffAccounts,
  spocs,
  singleCampus = false,
}: {
  rooms: RoomRow[];
  zones: ZoneRow[];
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  staffAccounts: ProfileRow[];
  spocs: ProfileRow[];
  singleCampus?: boolean;
}) {
  const staffById = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomById = (id: string | null) => rooms.find((r) => r.id === id) ?? null;
  const zoneById = (id: string | null) => zones.find((z) => z.id === id) ?? null;

  function activeMembersOf(teamsHere: TeamRow[]) {
    return teamsHere.flatMap((t) => (membersByTeam[t.id] ?? []).filter((m) => m.is_active));
  }
  function genderCounts(members: TeamMemberProfile[]) {
    return { people: members.length, male: members.filter((m) => m.gender === "Male").length, female: members.filter((m) => m.gender === "Female").length };
  }

  const selectClass = "rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-xs text-ink outline-none focus:border-gold";

  const [zoneHcCampus, setZoneHcCampus] = useState<CampusCode | "">("");
  const [zoneHcZone, setZoneHcZone] = useState("");
  const zoneHcZoneOptions = zoneHcCampus ? zones.filter((z) => z.campus === zoneHcCampus) : zones;

  const [venueHcCampus, setVenueHcCampus] = useState<CampusCode | "">("");
  const [venueHcZone, setVenueHcZone] = useState("");
  const [venueHcVenue, setVenueHcVenue] = useState("");
  const [venueHcSpoc, setVenueHcSpoc] = useState("");
  const venueHcZoneOptions = venueHcCampus ? zones.filter((z) => z.campus === venueHcCampus) : zones;
  const venueHcVenueOptions = rooms.filter((r) => {
    if (venueHcZone) return r.zone_id === venueHcZone;
    if (venueHcCampus) return r.campus === venueHcCampus;
    return true;
  });
  const venueHcSpocOptions = venueHcCampus ? spocs.filter((s) => s.campus === venueHcCampus) : spocs;

  // Only actual zones — a team with no venue (or a venue without a zone)
  // just doesn't count toward any row here, rather than showing a
  // permanent "Unassigned" placeholder.
  const zoneHeadcountRows = (() => {
    const rows = zones
      .filter((z) => (zoneHcCampus ? z.campus === zoneHcCampus : true) && (zoneHcZone ? z.id === zoneHcZone : true))
      .map((zone) => {
        const teamsHere = teams.filter((t) => t.is_active && roomById(t.room_id) && zoneById(roomById(t.room_id)!.zone_id)?.id === zone.id);
        return {
          key: zone.id,
          campus: zone.campus,
          zoneName: zone.name,
          zoneManager: staffById(zone.zone_manager_profile_id) ?? "Unassigned",
          teams: teamsHere.length,
          ...genderCounts(activeMembersOf(teamsHere)),
        };
      });
    return rows.sort((a, b) => {
      const campusDiff = CAMPUS_ORDER.indexOf(a.campus) - CAMPUS_ORDER.indexOf(b.campus);
      return campusDiff !== 0 ? campusDiff : a.zoneName.localeCompare(b.zoneName);
    });
  })();

  const venueHeadcountRows = rooms
    .filter(
      (r) =>
        (venueHcCampus ? r.campus === venueHcCampus : true) &&
        (venueHcZone ? r.zone_id === venueHcZone : true) &&
        (venueHcVenue ? r.id === venueHcVenue : true) &&
        (venueHcSpoc ? r.spoc_profile_id === venueHcSpoc : true),
    )
    .map((room) => {
      const teamsHere = teams.filter((t) => t.is_active && t.room_id === room.id);
      const zone = zoneById(room.zone_id);
      return {
        key: room.id,
        campus: room.campus,
        zoneName: zone?.name ?? "Unassigned",
        zoneManager: zone ? (staffById(zone.zone_manager_profile_id) ?? "Unassigned") : "-",
        venueName: room.name,
        spoc: staffById(room.spoc_profile_id) ?? "Unassigned",
        teams: teamsHere.length,
        ...genderCounts(activeMembersOf(teamsHere)),
      };
    })
    .sort((a, b) => {
      const campusDiff = CAMPUS_ORDER.indexOf(a.campus) - CAMPUS_ORDER.indexOf(b.campus);
      if (campusDiff !== 0) return campusDiff;
      const zoneDiff = a.zoneName.localeCompare(b.zoneName);
      return zoneDiff !== 0 ? zoneDiff : a.venueName.localeCompare(b.venueName);
    });

  function handleExportZoneHeadcountCsv() {
    downloadCsv(
      "zone-headcount",
      zoneHeadcountRows.map((r) => ({
        ...(singleCampus ? {} : { Campus: r.campus }),
        Zone: r.zoneName,
        "Zone Manager": r.zoneManager,
        "Number of Teams": String(r.teams),
        "Number of People": String(r.people),
        Male: String(r.male),
        Female: String(r.female),
      })),
    );
  }

  function handleExportVenueHeadcountCsv() {
    downloadCsv(
      "venue-headcount",
      venueHeadcountRows.map((r) => ({
        ...(singleCampus ? {} : { Campus: r.campus }),
        Zone: r.zoneName,
        "Zone Manager": r.zoneManager,
        Venue: r.venueName,
        SPOC: r.spoc,
        "Number of Teams": String(r.teams),
        "Number of People": String(r.people),
        Male: String(r.male),
        Female: String(r.female),
      })),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">By Zone</span>
          <button
            type="button"
            onClick={handleExportZoneHeadcountCsv}
            className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Download CSV
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
          {!singleCampus && (
            <select
              value={zoneHcCampus}
              onChange={(e) => {
                setZoneHcCampus(e.target.value as CampusCode | "");
                setZoneHcZone("");
              }}
              className={selectClass}
            >
              <option value="">Campus</option>
              {CAMPUS_ORDER.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select value={zoneHcZone} onChange={(e) => setZoneHcZone(e.target.value)} className={selectClass}>
            <option value="">Zone</option>
            {zoneHcZoneOptions.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          {(zoneHcCampus || zoneHcZone) && (
            <button
              type="button"
              onClick={() => {
                setZoneHcCampus("");
                setZoneHcZone("");
              }}
              className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
            >
              Clear Filters
            </button>
          )}
        </div>
        <p className="font-heading text-xs text-ink-muted">Showing {zoneHeadcountRows.length} zones</p>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                {!singleCampus && <th className="px-4 py-3">Campus</th>}
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Zone Manager</th>
                <th className="px-4 py-3">Number of Teams</th>
                <th className="px-4 py-3">Number of People</th>
                <th className="px-4 py-3">Male</th>
                <th className="px-4 py-3">Female</th>
              </tr>
            </thead>
            <tbody>
              {zoneHeadcountRows.length === 0 ? (
                <tr>
                  <td colSpan={singleCampus ? 6 : 7} className="px-4 py-8 text-center font-heading text-sm text-ink-muted">
                    No zones match these filters.
                  </td>
                </tr>
              ) : (
                zoneHeadcountRows.map((r) => (
                  <tr key={r.key} className="border-b border-border last:border-0">
                    {!singleCampus && <td className="px-4 py-3 text-ink-muted">{r.campus}</td>}
                    <td className="px-4 py-3 text-ink">{r.zoneName}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.zoneManager}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.teams}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.people}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.male}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.female}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">By Venue</span>
          <button
            type="button"
            onClick={handleExportVenueHeadcountCsv}
            className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Download CSV
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
          {!singleCampus && (
            <select
              value={venueHcCampus}
              onChange={(e) => {
                setVenueHcCampus(e.target.value as CampusCode | "");
                setVenueHcZone("");
                setVenueHcVenue("");
                setVenueHcSpoc("");
              }}
              className={selectClass}
            >
              <option value="">Campus</option>
              {CAMPUS_ORDER.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            value={venueHcZone}
            onChange={(e) => {
              setVenueHcZone(e.target.value);
              setVenueHcVenue("");
            }}
            className={selectClass}
          >
            <option value="">Zone</option>
            {venueHcZoneOptions.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <select value={venueHcVenue} onChange={(e) => setVenueHcVenue(e.target.value)} className={selectClass}>
            <option value="">Venue</option>
            {venueHcVenueOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select value={venueHcSpoc} onChange={(e) => setVenueHcSpoc(e.target.value)} className={selectClass}>
            <option value="">SPOC</option>
            {venueHcSpocOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {(venueHcCampus || venueHcZone || venueHcVenue || venueHcSpoc) && (
            <button
              type="button"
              onClick={() => {
                setVenueHcCampus("");
                setVenueHcZone("");
                setVenueHcVenue("");
                setVenueHcSpoc("");
              }}
              className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
            >
              Clear Filters
            </button>
          )}
        </div>
        <p className="font-heading text-xs text-ink-muted">Showing {venueHeadcountRows.length} venues</p>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                {!singleCampus && <th className="px-4 py-3">Campus</th>}
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Zone Manager</th>
                <th className="px-4 py-3">Venue</th>
                <th className="px-4 py-3">SPOC</th>
                <th className="px-4 py-3">Number of Teams</th>
                <th className="px-4 py-3">Number of People</th>
                <th className="px-4 py-3">Male</th>
                <th className="px-4 py-3">Female</th>
              </tr>
            </thead>
            <tbody>
              {venueHeadcountRows.length === 0 ? (
                <tr>
                  <td colSpan={singleCampus ? 7 : 8} className="px-4 py-8 text-center font-heading text-sm text-ink-muted">
                    No venues match these filters.
                  </td>
                </tr>
              ) : (
                venueHeadcountRows.map((r) => (
                  <tr key={r.key} className="border-b border-border last:border-0">
                    {!singleCampus && <td className="px-4 py-3 text-ink-muted">{r.campus}</td>}
                    <td className="px-4 py-3 text-ink">{r.zoneName}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.zoneManager}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.venueName}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.spoc}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.teams}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.people}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.male}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.female}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
