import { Command } from "commander";

function bashScript(): string {
  return `#!/bin/bash
# delta shell completions for bash
# Installation:
#   eval "$(delta completion bash)"
# Or add to ~/.bashrc:
#   source <(delta completion bash)

_delta_completions() {
    local cur prev words cword
    _init_completion || return

    local nouns="task cat cron auth sync feed import export invite share config integration completion help"
    local universal_flags="--json --jq --quiet --no-color --server --debug --help --version --yes"

    local task_verbs="list add edit done delete wip block pending dep"
    local task_dep_verbs="add rm list"
    local task_mutate_flags="--due --category --priority --start --end --all-day --recurrence --recur-mode --location --meeting --notes --status --scope"
    local cron_verbs="list add edit delete run enable disable"
    local auth_verbs="login logout status token"
    local auth_token_verbs="regenerate"
    local feed_verbs="generate revoke"
    local invite_verbs="list create"
    local config_verbs="get set"
    local integration_verbs="list test"
    local completion_verbs="bash zsh fish"
    local help_topics="filters dates auth examples"

    case "\${words[1]}" in
        task)
            case "\${words[2]}" in
                add|edit)
                    COMPREPLY=($(compgen -W "\${task_mutate_flags} \${universal_flags}" -- "\${cur}"))
                    return
                    ;;
                dep)
                    if [[ \${cword} -eq 3 ]]; then
                        COMPREPLY=($(compgen -W "\${task_dep_verbs}" -- "\${cur}"))
                        return
                    fi
                    COMPREPLY=($(compgen -W "\${universal_flags}" -- "\${cur}"))
                    return
                    ;;
                list|done|delete|wip|block|pending)
                    COMPREPLY=($(compgen -W "\${universal_flags}" -- "\${cur}"))
                    return
                    ;;
            esac
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "\${task_verbs}" -- "\${cur}"))
                return
            fi
            ;;
        cron)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "\${cron_verbs}" -- "\${cur}"))
                return
            fi
            COMPREPLY=($(compgen -W "\${universal_flags}" -- "\${cur}"))
            return
            ;;
        auth)
            case "\${words[2]}" in
                token)
                    if [[ \${cword} -eq 3 ]]; then
                        COMPREPLY=($(compgen -W "\${auth_token_verbs}" -- "\${cur}"))
                        return
                    fi
                    COMPREPLY=($(compgen -W "\${universal_flags}" -- "\${cur}"))
                    return
                    ;;
            esac
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "\${auth_verbs}" -- "\${cur}"))
                return
            fi
            COMPREPLY=($(compgen -W "\${universal_flags}" -- "\${cur}"))
            return
            ;;
        feed)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "\${feed_verbs}" -- "\${cur}"))
                return
            fi
            COMPREPLY=($(compgen -W "\${universal_flags}" -- "\${cur}"))
            return
            ;;
        invite)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "\${invite_verbs}" -- "\${cur}"))
                return
            fi
            COMPREPLY=($(compgen -W "\${universal_flags}" -- "\${cur}"))
            return
            ;;
        config)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "\${config_verbs}" -- "\${cur}"))
                return
            fi
            COMPREPLY=($(compgen -W "\${universal_flags}" -- "\${cur}"))
            return
            ;;
        integration)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "\${integration_verbs}" -- "\${cur}"))
                return
            fi
            COMPREPLY=($(compgen -W "\${universal_flags}" -- "\${cur}"))
            return
            ;;
        completion)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "\${completion_verbs}" -- "\${cur}"))
                return
            fi
            return
            ;;
        help)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "\${help_topics}" -- "\${cur}"))
                return
            fi
            return
            ;;
    esac

    if [[ \${cword} -eq 1 ]]; then
        COMPREPLY=($(compgen -W "\${nouns} \${universal_flags}" -- "\${cur}"))
        return
    fi
}

complete -F _delta_completions delta
`;
}

function zshScript(): string {
  return `#compdef delta
# delta shell completions for zsh
# Installation:
#   delta completion zsh > ~/.zfunc/_delta
#   # Then add ~/.zfunc to your fpath (before compinit) in ~/.zshrc:
#   #   fpath=(~/.zfunc $fpath)
#   #   autoload -Uz compinit && compinit

_delta() {
    local -a universal_flags
    universal_flags=(
        '--json[JSON output (optional comma-separated field list)]'
        '--jq[Filter JSON output (implies --json)]:expr:'
        '(-q --quiet)'{-q,--quiet}'[IDs only or nothing on success]'
        '--no-color[Disable color output]'
        '--server[Override server URL]:url:'
        '--debug[Print HTTP requests and responses to stderr]'
        '--help[Show help]'
        '--version[Show version]'
        '(-y --yes)'{-y,--yes}'[Skip confirmation prompts]'
    )

    local -a task_mutate_flags
    task_mutate_flags=(
        '--due[Due date]:date:'
        '--category[Category name]:name:'
        '--priority[Priority]:n:'
        '--start[Start time]:datetime:'
        '--end[End time]:datetime:'
        '--all-day[All-day event]'
        '--recurrence[Recurrence rule]:text:'
        '--recur-mode[Recurrence mode]:mode:(scheduled completion)'
        '--location[Location string]:text:'
        '--meeting[Meeting URL]:url:'
        '--notes[Plain text notes]:text:'
        '--status[Task status]:status:(pending wip done blocked cancelled)'
        '--scope[Recurrence edit scope]:scope:(this future all)'
    )

    local line state

    _arguments -C \\
        "\${universal_flags[@]}" \\
        '1:command:->command' \\
        '*::arg:->args'

    case $state in
        command)
            local -a commands
            commands=(
                'task:Task CRUD and status changes'
                'cat:List categories with task counts'
                'cron:Automation management'
                'auth:Authentication'
                'sync:Trigger Google Calendar sync'
                'feed:iCal feed management'
                'import:Import from iCal or other sources'
                'export:Export as iCal'
                'invite:Invite link management'
                'share:Generate share link for a task'
                'config:Settings management'
                'integration:Integration management'
                'completion:Shell completion generation'
                'help:Built-in help topics'
            )
            _describe 'command' commands
            ;;
        args)
            case $line[1] in
                task)
                    _arguments -C \\
                        '1:verb:->task_verb' \\
                        '*::arg:->task_args'
                    case $state in
                        task_verb)
                            local -a verbs
                            verbs=(
                                'list:List tasks with filters'
                                'add:Create a task'
                                'edit:Update a task'
                                'done:Complete task(s)'
                                'delete:Soft-delete task(s)'
                                'wip:Set task(s) to wip'
                                'block:Set task(s) to blocked'
                                'pending:Set task(s) to pending'
                                'dep:Dependency management'
                            )
                            _describe 'verb' verbs
                            ;;
                        task_args)
                            case $line[1] in
                                add|edit)
                                    _arguments "\${task_mutate_flags[@]}" "\${universal_flags[@]}"
                                    ;;
                                dep)
                                    _arguments -C \\
                                        '1:dep verb:->dep_verb' \\
                                        '*::arg:->dep_args'
                                    case $state in
                                        dep_verb)
                                            local -a dep_verbs
                                            dep_verbs=(
                                                'add:Add dependency'
                                                'rm:Remove dependency'
                                                'list:List dependencies'
                                            )
                                            _describe 'dep verb' dep_verbs
                                            ;;
                                        dep_args)
                                            _arguments "\${universal_flags[@]}"
                                            ;;
                                    esac
                                    ;;
                                *)
                                    _arguments "\${universal_flags[@]}"
                                    ;;
                            esac
                            ;;
                    esac
                    ;;
                cron)
                    local -a verbs
                    verbs=(
                        'list:List automations'
                        'add:Create automation'
                        'edit:Update automation'
                        'delete:Delete automation'
                        'run:Trigger automation manually'
                        'enable:Enable automation'
                        'disable:Disable automation'
                    )
                    _arguments -C \\
                        '1:verb:->cron_verb' \\
                        '*::arg:->cron_args'
                    case $state in
                        cron_verb)
                            _describe 'verb' verbs
                            ;;
                        cron_args)
                            _arguments "\${universal_flags[@]}"
                            ;;
                    esac
                    ;;
                auth)
                    _arguments -C \\
                        '1:verb:->auth_verb' \\
                        '*::arg:->auth_args'
                    case $state in
                        auth_verb)
                            local -a verbs
                            verbs=(
                                'login:Authenticate with the server'
                                'logout:Clear stored credentials'
                                'status:Show current user and auth method'
                                'token:Display or manage API token'
                            )
                            _describe 'verb' verbs
                            ;;
                        auth_args)
                            case $line[1] in
                                token)
                                    _arguments -C \\
                                        '1:token verb:->token_verb' \\
                                        '*::arg:->token_args'
                                    case $state in
                                        token_verb)
                                            local -a token_verbs
                                            token_verbs=(
                                                'regenerate:Regenerate API token'
                                            )
                                            _describe 'token verb' token_verbs
                                            ;;
                                        token_args)
                                            _arguments "\${universal_flags[@]}"
                                            ;;
                                    esac
                                    ;;
                                *)
                                    _arguments "\${universal_flags[@]}"
                                    ;;
                            esac
                            ;;
                    esac
                    ;;
                feed)
                    local -a verbs
                    verbs=(
                        'generate:Generate/regenerate feed URL'
                        'revoke:Revoke feed URL'
                    )
                    _arguments -C \\
                        '1:verb:->feed_verb' \\
                        '*::arg:->feed_args'
                    case $state in
                        feed_verb)
                            _describe 'verb' verbs
                            ;;
                        feed_args)
                            _arguments "\${universal_flags[@]}"
                            ;;
                    esac
                    ;;
                invite)
                    local -a verbs
                    verbs=(
                        'list:List invite links'
                        'create:Generate invite link'
                    )
                    _arguments -C \\
                        '1:verb:->invite_verb' \\
                        '*::arg:->invite_args'
                    case $state in
                        invite_verb)
                            _describe 'verb' verbs
                            ;;
                        invite_args)
                            _arguments "\${universal_flags[@]}"
                            ;;
                    esac
                    ;;
                config)
                    local -a verbs
                    verbs=(
                        'get:Get a setting value'
                        'set:Set a setting value'
                    )
                    _arguments -C \\
                        '1:verb:->config_verb' \\
                        '*::arg:->config_args'
                    case $state in
                        config_verb)
                            _describe 'verb' verbs
                            ;;
                        config_args)
                            _arguments "\${universal_flags[@]}"
                            ;;
                    esac
                    ;;
                integration)
                    local -a verbs
                    verbs=(
                        'list:List configured integrations'
                        'test:Test integration API key'
                    )
                    _arguments -C \\
                        '1:verb:->integration_verb' \\
                        '*::arg:->integration_args'
                    case $state in
                        integration_verb)
                            _describe 'verb' verbs
                            ;;
                        integration_args)
                            _arguments "\${universal_flags[@]}"
                            ;;
                    esac
                    ;;
                completion)
                    local -a verbs
                    verbs=(
                        'bash:Output bash completions'
                        'zsh:Output zsh completions'
                        'fish:Output fish completions'
                    )
                    _describe 'verb' verbs
                    ;;
                help)
                    local -a topics
                    topics=(
                        'filters:Filter syntax reference'
                        'dates:Date format reference'
                        'auth:Authentication setup'
                        'examples:Workflow recipes'
                    )
                    _describe 'topic' topics
                    ;;
                *)
                    _arguments "\${universal_flags[@]}"
                    ;;
            esac
            ;;
    esac
}

_delta "$@"
`;
}

function fishScript(): string {
  return `# delta shell completions for fish
# Installation:
#   delta completion fish > ~/.config/fish/completions/delta.fish

set -l nouns task cat cron auth sync feed import export invite share config integration completion help

complete -c delta -e

complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a task -d "Task CRUD and status changes"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a cat -d "List categories with task counts"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a cron -d "Automation management"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a auth -d "Authentication"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a sync -d "Trigger Google Calendar sync"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a feed -d "iCal feed management"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a import -d "Import from iCal or other sources"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a export -d "Export as iCal"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a invite -d "Invite link management"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a share -d "Generate share link for a task"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a config -d "Settings management"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a integration -d "Integration management"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a completion -d "Shell completion generation"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a help -d "Built-in help topics"

complete -c delta -l json -d "JSON output (optional comma-separated field list)"
complete -c delta -l jq -r -d "Filter JSON output (implies --json)"
complete -c delta -s q -l quiet -d "IDs only or nothing on success"
complete -c delta -l no-color -d "Disable color output"
complete -c delta -l server -r -d "Override server URL"
complete -c delta -l debug -d "Print HTTP requests and responses to stderr"
complete -c delta -l help -d "Show help"
complete -c delta -l version -d "Show version"
complete -c delta -s y -l yes -d "Skip confirmation prompts"

set -l task_verbs list add edit done delete wip block pending dep
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a list -d "List tasks with filters"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a add -d "Create a task"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a edit -d "Update a task"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a done -d "Complete task(s)"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a delete -d "Soft-delete task(s)"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a wip -d "Set task(s) to wip"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a block -d "Set task(s) to blocked"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a pending -d "Set task(s) to pending"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a dep -d "Dependency management"

complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l due -r -d "Due date"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l category -r -d "Category name"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l priority -r -d "Priority"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l start -r -d "Start time"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l end -r -d "End time"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l all-day -d "All-day event"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l recurrence -r -d "Recurrence rule"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l recur-mode -r -a "scheduled completion" -d "Recurrence mode"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l location -r -d "Location string"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l meeting -r -d "Meeting URL"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l notes -r -d "Plain text notes"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l status -r -a "pending wip done blocked cancelled" -d "Task status"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l scope -r -a "this future all" -d "Recurrence edit scope"

set -l dep_verbs add rm list
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from dep; and not __fish_seen_subcommand_from $dep_verbs" -a add -d "Add dependency"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from dep; and not __fish_seen_subcommand_from $dep_verbs" -a rm -d "Remove dependency"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from dep; and not __fish_seen_subcommand_from $dep_verbs" -a list -d "List dependencies"

set -l cron_verbs list add edit delete run enable disable
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a list -d "List automations"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a add -d "Create automation"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a edit -d "Update automation"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a delete -d "Delete automation"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a run -d "Trigger automation manually"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a enable -d "Enable automation"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a disable -d "Disable automation"

set -l auth_verbs login logout status token
complete -c delta -n "__fish_seen_subcommand_from auth; and not __fish_seen_subcommand_from $auth_verbs" -a login -d "Authenticate with the server"
complete -c delta -n "__fish_seen_subcommand_from auth; and not __fish_seen_subcommand_from $auth_verbs" -a logout -d "Clear stored credentials"
complete -c delta -n "__fish_seen_subcommand_from auth; and not __fish_seen_subcommand_from $auth_verbs" -a status -d "Show current user and auth method"
complete -c delta -n "__fish_seen_subcommand_from auth; and not __fish_seen_subcommand_from $auth_verbs" -a token -d "Display or manage API token"

complete -c delta -n "__fish_seen_subcommand_from auth; and __fish_seen_subcommand_from token" -a regenerate -d "Regenerate API token"

set -l feed_verbs generate revoke
complete -c delta -n "__fish_seen_subcommand_from feed; and not __fish_seen_subcommand_from $feed_verbs" -a generate -d "Generate/regenerate feed URL"
complete -c delta -n "__fish_seen_subcommand_from feed; and not __fish_seen_subcommand_from $feed_verbs" -a revoke -d "Revoke feed URL"

set -l invite_verbs list create
complete -c delta -n "__fish_seen_subcommand_from invite; and not __fish_seen_subcommand_from $invite_verbs" -a list -d "List invite links"
complete -c delta -n "__fish_seen_subcommand_from invite; and not __fish_seen_subcommand_from $invite_verbs" -a create -d "Generate invite link"

set -l config_verbs get set
complete -c delta -n "__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from $config_verbs" -a get -d "Get a setting value"
complete -c delta -n "__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from $config_verbs" -a set -d "Set a setting value"

set -l integration_verbs list test
complete -c delta -n "__fish_seen_subcommand_from integration; and not __fish_seen_subcommand_from $integration_verbs" -a list -d "List configured integrations"
complete -c delta -n "__fish_seen_subcommand_from integration; and not __fish_seen_subcommand_from $integration_verbs" -a test -d "Test integration API key"

set -l completion_verbs bash zsh fish
complete -c delta -n "__fish_seen_subcommand_from completion; and not __fish_seen_subcommand_from $completion_verbs" -a bash -d "Output bash completions"
complete -c delta -n "__fish_seen_subcommand_from completion; and not __fish_seen_subcommand_from $completion_verbs" -a zsh -d "Output zsh completions"
complete -c delta -n "__fish_seen_subcommand_from completion; and not __fish_seen_subcommand_from $completion_verbs" -a fish -d "Output fish completions"

complete -c delta -n "__fish_seen_subcommand_from help" -a "filters dates auth examples" -d "Help topic"
`;
}

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
