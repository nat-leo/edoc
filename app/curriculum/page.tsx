import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Curriculum = {
    name: string;
    totalProblems: number;
    progress: number;
    content: string;
}

export function CurriculumCard({name, totalProblems, progress, content} : Curriculum) {
  return (
    <Card>
        <CardHeader>
            <CardTitle>{name}</CardTitle>
            <CardDescription>{progress} / {totalProblems} Problems</CardDescription>
        </CardHeader>
        <CardContent>
            <p>{content}</p>
        </CardContent>
        <div className="grid grid-cols-2 gap-2">
            <Button>Learn</Button>
            <Button>Test</Button>
        </div>
    </Card>
  );
}

export default function CurriculumPage() {
  // API call here. Call user progress collection to get their attempts and tries.
  const curriculums: Curriculum[] = [
    {name: "Arrays", progress: 3, totalProblems: 10, content: "bwerdhgerw weqfpref fwefewlabfvera"},
    {name: "Matrices", progress: 3, totalProblems: 10, content: "bwerdhgerw weqfpref fwefewlabfvera"},
    {name: "Graphs", progress: 3, totalProblems: 10, content: "bwerdhgerw weqfpref fwefewlabfvera"},
    {name: "Stacks", progress: 3, totalProblems: 10, content: "bwerdhgerw weqfpref fwefewlabfvera"},
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {curriculums.map((curr) => (
          <CurriculumCard name={curr.name} progress={curr.progress} totalProblems={curr.totalProblems} content={curr.content}/>   
        ))}
    </div>
  );
}