export interface McStatsCreditedProps {
  /** The name as the stats give it, with a custom pack's credit as "Name (by Designer)" when it has one. */
  label: string;
  /** The most lines the name may take; with two or more the credit keeps a line of its own. */
  lines: number;
}
