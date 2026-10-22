import IconButton from "@mui/material/IconButton";
import type { ReactNode } from "react";
import { Icon } from "@/components/delivery/icons";
import { RiderJobBoard } from "@/components/delivery/rider-job-board";
import { Notice } from "@/components/delivery/rider-tools";
import type { DeliveryJob } from "@/lib/delivery/jobs";
import type { VehicleOption } from "@/lib/delivery/types";

export function RiderJobsScreen({
  vehicles,
  activeJob,
  isPreview,
  onJobTaken,
  onOpenMenu,
  onGoRoute,
  flash,
  sheets,
  previewBar,
}: {
  vehicles: VehicleOption[];
  activeJob: boolean;
  isPreview: boolean;
  onJobTaken: (job: DeliveryJob) => void;
  onOpenMenu: () => void;
  onGoRoute: () => void;
  flash: string | null;
  sheets: ReactNode;
  previewBar: ReactNode;
}) {
  const blocked = activeJob ? "Finish your current job first" : null;

  return (
    <>
      <main className="rf-app dv-overview">
        <RiderJobBoard
          vehicles={vehicles}
          blocked={blocked}
          sampleJobs={isPreview}
          onTaken={onJobTaken}
          menu={
            <IconButton
              onClick={onOpenMenu}
              aria-label="Shift tools"
              sx={{ width: 44, height: 44, color: "text.primary" }}
            >
              <Icon name="menu" size={20} />
            </IconButton>
          }
          notices={
            <>
              {activeJob && (
                <Notice
                  tone="info"
                  icon="truck"
                  action={
                    <button
                      type="button"
                      className="rf-link"
                      onClick={onGoRoute}
                    >
                      Open route
                    </button>
                  }
                >
                  <strong>You have a job in progress.</strong> Finish it before
                  taking another.
                </Notice>
              )}
              {flash && (
                <Notice tone="success" icon="check">
                  {flash}
                </Notice>
              )}
            </>
          }
        />
      </main>
      {sheets}
      {previewBar}
    </>
  );
}
