/** "Edit which deck?": a button per seat and Cancel. Every word arrives translated. */
export interface SeatPickerModel {
  readonly title: string;
  readonly seats: readonly { readonly seat: number; readonly label: string }[];
  readonly cancel: string;
}
