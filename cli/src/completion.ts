import { Command } from "commander";
import { bashScript } from "./completions/bash.js";
import { fishScript } from "./completions/fish.js";
import { zshScript } from "./completions/zsh.js";

export function registerCompletionCommands(program: Command): void {
  const completion = new Command("completion").description(
    "Shell completion generation",
  );

  completion
    .command("bash")
    .description("Output bash completions")
    .action(() => {
      process.stdout.write(bashScript());
    });

  completion
    .command("zsh")
    .description("Output zsh completions")
    .action(() => {
      process.stdout.write(zshScript());
    });

  completion
    .command("fish")
    .description("Output fish completions")
    .action(() => {
      process.stdout.write(fishScript());
    });

  program.addCommand(completion);
}
