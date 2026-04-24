import { RoomSetupScreen } from "../../../components/next/room-setup-screen";

type RoomPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;
  return <RoomSetupScreen roomId={id} />;
}
