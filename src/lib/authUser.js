/** Map API `user` fields to shapes older screens expect (`municipality`, `barangay`). */
export function sessionUserFromAuth(user) {
  if (!user) return null;
  return {
    ...user,
    municipality: user.municipalityName ?? user.municipality ?? "",
    barangay: user.barangayName ?? user.barangay ?? ""
  };
}

/** Report Case encoding is limited to barangay BHU accounts. */
export function userCanReportCase(user) {
  return user?.role === "barangay";
}
