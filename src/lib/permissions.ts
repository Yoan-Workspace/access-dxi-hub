import type { User, UserRole } from "./types";

export function canCreateMachine(role?: UserRole) {
  return role === "admin" || role === "technicien";
}

export function canEditMachine(role?: UserRole) {
  return role === "admin" || role === "technicien";
}

export function canDeleteMachine(role?: UserRole) {
  return role === "admin" || role === "technicien";
}

export function canCreateTicket(role?: UserRole) {
  return Boolean(role);
}

export function canEditTicket(role?: UserRole) {
  return role === "admin" || role === "technicien";
}

export function canDeleteTicket(role?: UserRole) {
  return role === "admin" || role === "technicien";
}

export function canManageUsers(role?: UserRole) {
  return role === "admin";
}

export function roleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Administrateur";
    case "technicien":
      return "Technicien";
    case "operateur":
      return "Opérateur";
  }
}

export const TICKET_CATEGORY_LABELS: Record<
  import("./types").TicketCategory,
  string
> = {
  reparation: "Réparation",
  probleme: "Problème",
  flag: "Flag",
  non_classe: "Non classé",
};

export function isReadOnlyUser(user: User | null) {
  return user?.role === "operateur";
}
