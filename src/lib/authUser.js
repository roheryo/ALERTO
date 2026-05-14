/** Map API `user` fields to shapes older screens expect (`municipality`, `barangay`). */
export function sessionUserFromAuth(user) {
  if (!user) return null;
  return {
    ...user,
    municipality: user.municipalityName ?? user.municipality ?? "",
    barangay: user.barangayName ?? user.barangay ?? ""
  };
}
