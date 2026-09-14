// Server component. Slots two server subtrees through a client boundary:
// the interleaving case where parent-tree rows mix server and client but
// the owner tree keeps clean regions.
import { ClientFrame } from "./client-frame";
import { ServerStats } from "./server-stats";
import { ServerList } from "./server-list";

export default function Page() {
  return (
    <ClientFrame sidebar={<ServerStats label="visits" value={42} />}>
      <ServerList items={["alpha", "beta", "gamma"]} />
    </ClientFrame>
  );
}
