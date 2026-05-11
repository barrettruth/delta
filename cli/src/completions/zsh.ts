export function zshScript(): string {
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
                'feed:iCal subscription management'
                'import:Import from iCal or other sources'
                'export:Export as iCal'
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
                                'login:Store an API token for this server'
                                'logout:Clear stored credentials'
                                'status:Show current user and token source'
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
                        'generate:Generate/regenerate subscription URL'
                        'revoke:Revoke subscription URL'
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
