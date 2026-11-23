export function getEquipmentPreviewImage(
  equipmentId: string,
  name = "",
  department = ""
): string {
  const byId: Record<string, string> = {
    eq_jetson_agx: "/images/eq_agx_orin.jpg",
    eq_agx_1: "/images/eq_agx_orin.jpg",
    eq_jetson_nano: "/images/eq_orin_nano.jpg",
    eq_nano_1: "/images/eq_orin_nano.jpg",
    eq_rplidar: "/images/eq_rplidar.jpg",
    eq_lidar_1: "/images/eq_rplidar.jpg",
    eq_oscilloscope: "/images/eq_oscilloscope.jpg",
    eq_scope_1: "/images/eq_oscilloscope.jpg",
    eq_fpga: "/images/eq_fpga.jpg",
    eq_fpga_1: "/images/eq_fpga.jpg",
    eq_3dprinter: "/images/eq_3d_printer.jpg",
    eq_printer_1: "/images/eq_3d_printer.jpg",
  };

  if (byId[equipmentId]) return byId[equipmentId];

  const hay = `${equipmentId} ${name} ${department}`.toLowerCase();
  if (hay.includes("agx")) return "/images/eq_agx_orin.jpg";
  if (hay.includes("nano")) return "/images/eq_orin_nano.jpg";
  if (hay.includes("lidar") || hay.includes("robotics")) return "/images/eq_rplidar.jpg";
  if (hay.includes("oscilloscope") || hay.includes("mso")) return "/images/eq_oscilloscope.jpg";
  if (hay.includes("fpga") || hay.includes("zynq")) return "/images/eq_fpga.jpg";
  if (hay.includes("3d") || hay.includes("printer") || hay.includes("mechanical")) {
    return "/images/eq_3d_printer.jpg";
  }

  return "/images/eq_agx_orin.jpg";
}