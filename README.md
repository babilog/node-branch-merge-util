# Git Branch Auto Merge

Utility to automatically merge branches based on semver version number. It's meant to be run either as a Jenkins job, or locally.

For example, if you have a branch for `release/v3.4.0`, `hotfix/v3.2.0` and a main branch called `develop`. The utility will first merge `hotfix/v3.2.0` -> `release/v3.4.0` due to the lower version from the hotfix branch. It will then take the `release/v3.4.0` branch and it will merge it into `develop` (your main branch).

The version comparion is done using the semver version library that npm uses. So it will be done in a consistent manner as long as proper branch semver versioning conventions are followed.

In addition to the auto merging cabilility, the utility will also setup a merge strategy to ignore merge conflicts around the `app-version.json` file. This is to ensure that we can keep the version from the host branch and not overwrite it or fail the auto merge due to having different versions across branches. You can read more about merge strategies and the `.gitattributes` file here

- https://medium.com/@porteneuve/how-to-make-git-preserve-specific-files-while-merging-18c92343826b
- https://git-scm.com/book/en/v2/Customizing-Git-Git-Attributes

## Getting Started

```
> npm i
> node ./branch-merge.js --branchPrefixList=release_test --masterBranch=develop_test
```

### Prerequisites

Make sure that you have your git account setup locally since it'll run `git` commands under your name.

### Args

#### `--branchPrefixList` (string list space - delimited)

Will scope your branch list for merging based on the naming specified.

Example Usage:

```
node ./branch-merge.js --branchPrefixList=release_test support_test--masterBranch=develop_test
```

The utility will only merge the branches that start with `release_test/*` and `support_test/*`. It will ignore all other branches on your repo.

**NOTE:** If you don't specify this arg, the utility will assume you want to merge any branch with the following naming convention `name/v[0-9].[0-9].[0-9]`.

#### `--masterBranch` (string - required)

Specifies the master branch where the highest versioned branch will be merged into.

For example, if `release/v3.4.0` is the highest version you have on your repo, then `release/v3.4.0` will be merged into your master branch.

Example Usage:

```
node ./branch-merge.js --masterBranch=develop_test
```

#### `--push` (optional)

If specified, it will actually push the merge changes to the host branch. If not specified, it will perform a dry-run of the commands it will execute and print them to the console, and _will not push_ your merge changes.

Please keep in mind that if you have merge priviledge on your branch, and you do add the flag, it will perform the merge operation and will push the changes. **So make sure you know what you are doing if you do specify it locally** 💪

## Debugging

If you'd like to debug the script locally and are running VSCode, you can use the following debug config:

```
{
      "type": "node",
      "request": "launch",
      "name": "Branch merge",
      "program": "${workspaceFolder}/branch-merge-cli/branch-merge.js",
      "args": ["--branchPrefixList=release_test", "--masterBranch=develop_test"],
      "cwd": "${workspaceFolder}",
      "autoAttachChildProcesses": true
}
```
