import { GameScreen } from "../../../components/next/game-screen";

type GamePageProps = {
  params: Promise<{ id: string }>;
};

export default async function GamePage({ params }: GamePageProps) {
  const { id } = await params;
  return <GameScreen roomId={id} />;
}
