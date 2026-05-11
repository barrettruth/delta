export function bashScript(): string {
  return `#!/bin/bash
# delta shell completions for bash
# Installation:
#   eval "$(delta completion bash)"
# Or add to ~/.bashrc:
#   source <(delta completion bash)

_delta_completions() {
    local cur prev words cword
    _init_completion || return

    local nouns="task cat cron auth feed import export config integration completion help"
    local universal_flags="--json --jq --quiet --no-color --server --debug --help --version --yes"

    local task_verbs="list add edit done delete wip block pending dep"
    local task_dep_verbs="add rm list"
    local task_mutate_flags="--due --category --priority --start --end --all-day --recurrence --recur-mode --location --meeting --notes --status --scope"
    local cron_verbs="list add edit delete run enable disable"
    local auth_verbs="login logout status token"
    local auth_token_verbs="regenerate"
    local feed_verbs="generate revoke"
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
